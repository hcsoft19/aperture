import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ChartInvitation = {
  id: string;
  email: string;
  expiresAt: string;
};

export type TreatmentComparisonSummary = {
  id: string;
  angleName: string;
  shared: boolean;
  aligned: boolean;
};

export async function getChartLink(patientId: string) {
  const supabase = await createClient();
  const [{ data: account, error: accountError }, { data: invitation, error: invitationError }] = await Promise.all([
    supabase.from("patient_accounts").select("id").eq("patient_id", patientId).maybeSingle(),
    supabase
      .from("patient_invitations")
      .select("id, email, expires_at")
      .eq("patient_id", patientId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .maybeSingle(),
  ]);

  if (accountError || invitationError) {
    throw new Error("Could not load the chart link.");
  }

  return {
    linked: Boolean(account),
    invitation: invitation
      ? { id: invitation.id, email: invitation.email, expiresAt: invitation.expires_at }
      : null,
  };
}

export async function listTreatmentComparisons(treatmentId: string): Promise<TreatmentComparisonSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comparisons")
    .select("id, shared_with_patient, revoked_at, alignment, photos!comparisons_after_photo_id_fkey(photography_angles(name))")
    .eq("treatment_id", treatmentId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Could not load comparisons.");
  }

  return (data ?? []).map((row) => {
    const photo = Array.isArray(row.photos) ? row.photos[0] : row.photos;
    const angle = photo ? (Array.isArray(photo.photography_angles) ? photo.photography_angles[0] : photo.photography_angles) : null;
    const alignment = row.alignment;
    const aligned = Boolean(
      alignment && typeof alignment === "object" && !Array.isArray(alignment) && "aligned" in alignment && alignment.aligned === true,
    );
    return {
      id: row.id,
      angleName: angle?.name ?? "Photograph",
      shared: row.shared_with_patient && row.revoked_at === null,
      aligned,
    };
  });
}
