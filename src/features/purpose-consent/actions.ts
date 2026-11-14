"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getWorkspace } from "@/features/access/workspace";
import {
  consentDecisionSchema,
  type ConsentActionResult,
} from "@/features/purpose-consent/schema";
import type { ConsentPurpose } from "@/features/purpose-consent/purposes";
import { createClient } from "@/lib/supabase/server";

type ConsentIntent = "grant" | "withdraw";

export async function grantConsentAction(
  previousOrForm: ConsentActionResult | null | FormData,
  formData?: FormData,
): Promise<ConsentActionResult> {
  const fields = previousOrForm instanceof FormData ? previousOrForm : formData;
  if (!fields) {
    return { status: "error", message: "Consent could not be recorded." };
  }

  return saveConsent(fields, "grant");
}

export async function withdrawConsentAction(
  previousOrForm: ConsentActionResult | null | FormData,
  formData?: FormData,
): Promise<ConsentActionResult> {
  const fields = previousOrForm instanceof FormData ? previousOrForm : formData;
  if (!fields) {
    return { status: "error", message: "Consent could not be withdrawn." };
  }

  return saveConsent(fields, "withdraw");
}

async function saveConsent(
  formData: FormData,
  intent: ConsentIntent,
): Promise<ConsentActionResult> {
  const parsed = consentDecisionSchema.safeParse({
    patientId: textField(formData, "patientId"),
    purpose: textField(formData, "purpose"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? failureMessage(intent),
    };
  }

  const workspace = await staffClinic();
  if (!workspace?.activeMembership) {
    return {
      status: "error",
      message: "Consent is limited to professionals in a clinic.",
    };
  }

  const supabase = await createClient();
  const organizationId = workspace.activeMembership.organizationId;
  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id")
    .eq("id", parsed.data.patientId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (patientError) {
    return { status: "error", message: failureMessage(intent) };
  }

  if (!patient) {
    return { status: "error", message: "This chart is not available." };
  }

  if (intent === "grant") {
    return grantPurpose({
      supabase,
      patientId: patient.id,
      organizationId,
      purpose: parsed.data.purpose,
      grantedBy: workspace.user.id,
    });
  }

  return withdrawPurpose({
    supabase,
    patientId: patient.id,
    organizationId,
    purpose: parsed.data.purpose,
  });
}

async function grantPurpose(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  patientId: string;
  organizationId: string;
  purpose: ConsentPurpose;
  grantedBy: string;
}): Promise<ConsentActionResult> {
  const { data: existing, error: existingError } = await input.supabase
    .from("consents")
    .select("id")
    .eq("patient_id", input.patientId)
    .eq("organization_id", input.organizationId)
    .eq("purpose", input.purpose)
    .is("revoked_at", null)
    .limit(1);

  if (existingError) {
    return { status: "error", message: "Consent could not be recorded." };
  }

  if (existing?.length) {
    return { status: "error", message: "This purpose is already granted." };
  }

  const { error } = await input.supabase.from("consents").insert({
    patient_id: input.patientId,
    organization_id: input.organizationId,
    granted_by: input.grantedBy,
    purpose: input.purpose,
  });

  if (error) {
    return { status: "error", message: "Consent could not be recorded." };
  }

  revalidateConsent(input.patientId);
  return { status: "success", message: "Consent recorded." };
}

async function withdrawPurpose(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  patientId: string;
  organizationId: string;
  purpose: ConsentPurpose;
}): Promise<ConsentActionResult> {
  const { data, error } = await input.supabase
    .from("consents")
    .update({ revoked_at: new Date().toISOString() })
    .eq("patient_id", input.patientId)
    .eq("organization_id", input.organizationId)
    .eq("purpose", input.purpose)
    .is("revoked_at", null)
    .select("id");

  if (error) {
    return { status: "error", message: "Consent could not be withdrawn." };
  }

  if (!data?.length) {
    return { status: "error", message: "This purpose is not granted." };
  }

  revalidateConsent(input.patientId);
  return { status: "success", message: "Consent withdrawn." };
}

function revalidateConsent(patientId: string) {
  revalidatePath(`/patients/${patientId}/consent`);
  revalidatePath(`/patients/${patientId}`);
  revalidatePath("/capture");
}

async function staffClinic() {
  const workspace = await getWorkspace();

  if (!workspace) {
    redirect("/login");
  }

  if (workspace.kind !== "staff" || !workspace.activeMembership) {
    return null;
  }

  return workspace;
}

function textField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function failureMessage(intent: ConsentIntent) {
  return intent === "grant"
    ? "Consent could not be recorded."
    : "Consent could not be withdrawn.";
}
