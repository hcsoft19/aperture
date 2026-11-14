"use server";

import { revalidatePath } from "next/cache";

import { getWorkspace } from "@/features/access/workspace";
import {
  invitationSchema,
  releaseSchema,
  shareSchema,
} from "@/features/sharing/schemas";
import { createInvitationToken } from "@/features/sharing/token";
import { isUuid } from "@/lib/ids";
import { createClient } from "@/lib/supabase/server";

export type SharingResult =
  { ok: false; message: string } | { ok: true; message: string; link?: string };

async function requireStaff() {
  const workspace = await getWorkspace();
  if (!workspace?.activeMembership || workspace.kind !== "staff") {
    return null;
  }
  return workspace;
}

export async function invitePatientAction(input: {
  patientId: string;
  email: string;
}): Promise<SharingResult> {
  const parsed = invitationSchema.safeParse(input);
  const workspace = await requireStaff();
  if (!parsed.success || !workspace?.activeMembership) {
    return { ok: false, message: "The invitation could not be created." };
  }

  const supabase = await createClient();
  const { data: patient, error } = await supabase
    .from("patients")
    .select("id, organization_id")
    .eq("id", parsed.data.patientId)
    .eq("organization_id", workspace.activeMembership.organizationId)
    .maybeSingle();

  if (error || !patient) {
    return { ok: false, message: "This chart is not available." };
  }

  const { data: linked } = await supabase
    .from("patient_accounts")
    .select("id")
    .eq("patient_id", patient.id)
    .maybeSingle();

  if (linked) {
    return {
      ok: false,
      message: "This chart is already linked to an account.",
    };
  }

  const { token, tokenHash } = createInvitationToken();
  const { error: inviteError } = await supabase
    .from("patient_invitations")
    .insert({
      organization_id: patient.organization_id,
      patient_id: patient.id,
      email: parsed.data.email.toLowerCase(),
      token_hash: tokenHash,
      invited_by: workspace.user.id,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

  if (inviteError) {
    return {
      ok: false,
      message: "Revoke the open invitation before creating another.",
    };
  }

  revalidatePath(`/patients/${patient.id}`);
  return {
    ok: true,
    message:
      "Invitation ready. Share this link with the patient. It expires in 7 days.",
    link: `/invite/${token}`,
  };
}

export async function revokeInvitationAction(
  invitationId: string,
): Promise<SharingResult> {
  if (!isUuid(invitationId)) {
    return { ok: false, message: "The invitation could not be revoked." };
  }

  const workspace = await requireStaff();
  if (!workspace) {
    return { ok: false, message: "The invitation could not be revoked." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", invitationId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select("patient_id");

  if (error || !data?.length) {
    return { ok: false, message: "The invitation could not be revoked." };
  }

  revalidatePath(`/patients/${data[0].patient_id}`);
  return { ok: true, message: "Invitation revoked." };
}

export async function setSessionReleaseAction(input: {
  sessionId: string;
  released: boolean;
}): Promise<SharingResult> {
  const parsed = releaseSchema.safeParse(input);
  const workspace = await requireStaff();
  if (!parsed.success || !workspace?.activeMembership) {
    return { ok: false, message: "The session could not be updated." };
  }

  const supabase = await createClient();
  const { data: session, error } = await supabase
    .from("photo_sessions")
    .select(
      "id, status, treatment_id, treatments!inner(patient_id, patients!inner(organization_id))",
    )
    .eq("id", parsed.data.sessionId)
    .eq(
      "treatments.patients.organization_id",
      workspace.activeMembership.organizationId,
    )
    .maybeSingle();

  if (error || !session || session.status !== "completed") {
    return { ok: false, message: "Only a finished session can be released." };
  }

  const { data: updated, error: updateError } = await supabase
    .from("photo_sessions")
    .update({ released_to_patient: parsed.data.released })
    .eq("id", session.id)
    .eq("status", "completed")
    .select("id");

  if (updateError || !updated?.length) {
    return { ok: false, message: "The session could not be updated." };
  }

  const treatment = Array.isArray(session.treatments)
    ? session.treatments[0]
    : session.treatments;
  revalidatePath(
    `/patients/${treatment.patient_id}/treatments/${session.treatment_id}`,
  );
  revalidatePath("/treatments");
  revalidatePath("/home");
  return {
    ok: true,
    message: parsed.data.released
      ? "Session released to the patient."
      : "Session hidden from the patient.",
  };
}

export async function setComparisonShareAction(input: {
  comparisonId: string;
  shared: boolean;
}): Promise<SharingResult> {
  const parsed = shareSchema.safeParse(input);
  const workspace = await requireStaff();
  if (!parsed.success || !workspace?.activeMembership) {
    return { ok: false, message: "The comparison could not be updated." };
  }

  const supabase = await createClient();
  const { data: comparison, error } = await supabase
    .from("comparisons")
    .select(
      "id, treatment_id, treatments!inner(patient_id, patients!inner(organization_id))",
    )
    .eq("id", parsed.data.comparisonId)
    .eq(
      "treatments.patients.organization_id",
      workspace.activeMembership.organizationId,
    )
    .maybeSingle();

  if (error || !comparison) {
    return { ok: false, message: "This comparison is not available." };
  }

  const { data: updated, error: updateError } = await supabase
    .from("comparisons")
    .update(
      parsed.data.shared
        ? {
            shared_with_patient: true,
            shared_at: new Date().toISOString(),
            revoked_at: null,
          }
        : { shared_with_patient: false, revoked_at: new Date().toISOString() },
    )
    .eq("id", comparison.id)
    .select("id");

  if (updateError || !updated?.length) {
    return { ok: false, message: "The comparison could not be updated." };
  }

  const treatment = Array.isArray(comparison.treatments)
    ? comparison.treatments[0]
    : comparison.treatments;
  revalidatePath(
    `/patients/${treatment.patient_id}/treatments/${comparison.treatment_id}`,
  );
  revalidatePath("/treatments");
  revalidatePath("/home");
  return {
    ok: true,
    message: parsed.data.shared
      ? "Comparison shared with the patient."
      : "Comparison hidden from the patient.",
  };
}

export async function acceptInvitationAction(
  token: string,
): Promise<SharingResult> {
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return { ok: false, message: "This invitation is not available." };
  }

  const workspace = await getWorkspace();
  if (!workspace) {
    return {
      ok: false,
      message: "Sign in with the invited email before accepting.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_patient_invitation", {
    raw_token: token,
  });

  if (error || data !== "accepted") {
    return { ok: false, message: "This invitation is not available." };
  }

  revalidatePath("/home");
  revalidatePath("/treatments");
  revalidatePath("/home");
  return { ok: true, message: "This chart is now linked to your account." };
}
