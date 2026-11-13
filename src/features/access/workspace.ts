import "server-only";

import { connection } from "next/server";
import { cache } from "react";

import { resolveWorkspaceKind, type WorkspaceKind } from "@/features/access/kind";
import { getVerifiedUser, type VerifiedUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type OrganizationRole = "clinic_admin" | "professional";

export type StaffMembership = {
  organizationId: string;
  organizationName: string;
  role: OrganizationRole;
};

export type PatientLink = {
  patientId: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  organizationName: string;
};

export type Workspace = {
  user: VerifiedUser;
  kind: WorkspaceKind;
  fullName: string | null;
  memberships: StaffMembership[];
  activeMembership: StaffMembership | null;
  patientLinks: PatientLink[];
};

type OrganizationEmbed = { id: string; name: string } | { id: string; name: string }[] | null;

function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

export const getWorkspace = cache(async (): Promise<Workspace | null> => {
  await connection();
  const user = await getVerifiedUser();

  if (!user) {
    return null;
  }

  const supabase = await createClient();
  const [profileResult, membershipResult, linkResult] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("organization_members")
      .select("role, organization_id, organizations(id, name)")
      .eq("profile_id", user.id),
    supabase
      .from("patient_accounts")
      .select("patient_id, patients(id, first_name, last_name, organization_id, organizations(id, name))")
      .eq("profile_id", user.id),
  ]);

  if (profileResult.error || membershipResult.error || linkResult.error) {
    throw new Error("Could not load the workspace.");
  }

  const memberships: StaffMembership[] = (membershipResult.data ?? []).flatMap((row) => {
    const organization = one(row.organizations as OrganizationEmbed);
    if (!organization) {
      return [];
    }

    return [
      {
        organizationId: organization.id,
        organizationName: organization.name,
        role: row.role,
      },
    ];
  });

  const patientLinks: PatientLink[] = (linkResult.data ?? []).flatMap((row) => {
    const patient = one(row.patients as {
      id: string;
      first_name: string;
      last_name: string;
      organization_id: string;
      organizations: OrganizationEmbed;
    } | Array<{
      id: string;
      first_name: string;
      last_name: string;
      organization_id: string;
      organizations: OrganizationEmbed;
    }> | null);

    const organization = patient ? one(patient.organizations) : null;
    if (!patient || !organization) {
      return [];
    }

    return [
      {
        patientId: patient.id,
        firstName: patient.first_name,
        lastName: patient.last_name,
        organizationId: organization.id,
        organizationName: organization.name,
      },
    ];
  });

  const activeMembership =
    memberships.find((membership) => membership.role === "clinic_admin") ??
    memberships[0] ??
    null;

  return {
    user,
    kind: resolveWorkspaceKind(memberships.length, patientLinks.length),
    fullName: profileResult.data?.full_name ?? null,
    memberships,
    activeMembership,
    patientLinks,
  };
});
