"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  memberEmailSchema,
  memberRoleSchema,
  organizationNameSchema,
  profileNameSchema,
  type MemberEmailValues,
  type OrganizationNameValues,
  type ProfileNameValues,
} from "@/features/organizations/schemas";
import { getVerifiedUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type OrganizationActionResult =
  | { status: "error"; message: string }
  | { status: "success"; message: string };

const SAFE_DATABASE_MESSAGES = new Set([
  "No account exists for that email",
  "That person is already a member of this clinic",
  "The clinic needs at least one administrator",
  "Only a clinic administrator can add members",
  "Only a clinic administrator can change roles",
  "Only a clinic administrator can remove members",
  "That person is not a member of this clinic",
]);

function safeDatabaseMessage(message: string | undefined, fallback: string) {
  if (!message) {
    return fallback;
  }

  for (const known of SAFE_DATABASE_MESSAGES) {
    if (message.includes(known)) {
      return known;
    }
  }

  return fallback;
}

async function requireSignedInClient() {
  const user = await getVerifiedUser();

  if (!user) {
    redirect("/login");
  }

  return createClient();
}

export async function createOrganizationAction(
  values: OrganizationNameValues,
): Promise<OrganizationActionResult> {
  const parsed = organizationNameSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the clinic name and try again.",
    };
  }

  const supabase = await requireSignedInClient();
  const { error } = await supabase.rpc("create_organization", {
    org_name: parsed.data.name,
  });

  if (error) {
    return {
      status: "error",
      message: safeDatabaseMessage(error.message, "The clinic could not be created."),
    };
  }

  revalidatePath("/", "layout");
  redirect("/home");
}

export async function updateProfileNameAction(
  values: ProfileNameValues,
): Promise<OrganizationActionResult> {
  const parsed = profileNameSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check your name and try again.",
    };
  }

  const user = await getVerifiedUser();
  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName })
    .eq("id", user.id)
    .select("id");

  if (error || !data?.length) {
    return { status: "error", message: "Your name could not be saved." };
  }

  revalidatePath("/profile");
  return { status: "success", message: "Name saved." };
}

export async function renameOrganizationAction(
  values: OrganizationNameValues & { organizationId: string },
): Promise<OrganizationActionResult> {
  const parsed = organizationNameSchema.safeParse(values);

  if (!parsed.success || !zUuid(values.organizationId)) {
    return { status: "error", message: "Check the clinic name and try again." };
  }

  const supabase = await requireSignedInClient();
  const { data, error } = await supabase
    .from("organizations")
    .update({ name: parsed.data.name })
    .eq("id", values.organizationId)
    .select("id");

  if (error || !data?.length) {
    return { status: "error", message: "The clinic name could not be saved." };
  }

  revalidatePath("/", "layout");
  return { status: "success", message: "Clinic name saved." };
}

export async function addOrganizationMemberAction(
  values: MemberEmailValues & { organizationId: string },
): Promise<OrganizationActionResult> {
  const parsed = memberEmailSchema.safeParse(values);

  if (!parsed.success || !zUuid(values.organizationId)) {
    return { status: "error", message: "Enter the email for an existing account." };
  }

  const supabase = await requireSignedInClient();
  const { error } = await supabase.rpc("add_organization_member", {
    target_org: values.organizationId,
    member_email: parsed.data.email,
  });

  if (error) {
    return {
      status: "error",
      message: safeDatabaseMessage(error.message, "The member could not be added."),
    };
  }

  revalidatePath("/profile");
  return { status: "success", message: "Professional added." };
}

export async function setOrganizationMemberRoleAction(input: {
  organizationId: string;
  profileId: string;
  role: "clinic_admin" | "professional";
}): Promise<OrganizationActionResult> {
  const parsed = memberRoleSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: "The role could not be changed." };
  }

  const supabase = await requireSignedInClient();
  const { error } = await supabase.rpc("set_organization_member_role", {
    target_org: parsed.data.organizationId,
    target_profile: parsed.data.profileId,
    next_role: parsed.data.role,
  });

  if (error) {
    return {
      status: "error",
      message: safeDatabaseMessage(error.message, "The role could not be changed."),
    };
  }

  revalidatePath("/profile");
  return { status: "success", message: "Role saved." };
}

export async function removeOrganizationMemberAction(input: {
  organizationId: string;
  profileId: string;
}): Promise<OrganizationActionResult> {
  if (!zUuid(input.organizationId) || !zUuid(input.profileId)) {
    return { status: "error", message: "The member could not be removed." };
  }

  const supabase = await requireSignedInClient();
  const { error } = await supabase.rpc("remove_organization_member", {
    target_org: input.organizationId,
    target_profile: input.profileId,
  });

  if (error) {
    return {
      status: "error",
      message: safeDatabaseMessage(error.message, "The member could not be removed."),
    };
  }

  revalidatePath("/profile");
  return { status: "success", message: "Member removed." };
}

function zUuid(value: unknown): value is string {
  return typeof value === "string" && zUuidPattern.test(value);
}

const zUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
