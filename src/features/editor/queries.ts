import "server-only";

import { createClient } from "@/lib/supabase/server";
import { parseEdit, type EditDocument } from "@/features/editor/schema";

export type EditablePhoto = {
  id: string;
  patientId: string;
  organizationId: string;
  angleName: string;
  capturedAt: string | null;
  width: number | null;
  height: number | null;
  signedUrl: string;
  revisionId: string | null;
  revisionNumber: number | null;
  edit: EditDocument | null;
};

export async function getEditablePhoto(
  organizationId: string,
  patientId: string,
  photoId: string,
): Promise<EditablePhoto | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("photos")
    .select(
      "id, captured_at, width, height, storage_path, upload_status, photography_angles(name), photo_sessions!inner(treatments!inner(patient_id, patients!inner(organization_id)))",
    )
    .eq("id", photoId)
    .eq("upload_status", "uploaded")
    .eq("photo_sessions.treatments.patient_id", patientId)
    .eq("photo_sessions.treatments.patients.organization_id", organizationId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const signed = await supabase.storage.from("clinical-photos").createSignedUrl(data.storage_path, 180);
  if (!signed.data?.signedUrl) {
    return null;
  }

  const revision = await supabase
    .from("photo_edit_revisions")
    .select("id, revision_number, edit_data")
    .eq("photo_id", photoId)
    .order("revision_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const angle = Array.isArray(data.photography_angles) ? data.photography_angles[0] : data.photography_angles;

  return {
    id: data.id,
    patientId,
    organizationId,
    angleName: angle?.name ?? "Photograph",
    capturedAt: data.captured_at,
    width: data.width,
    height: data.height,
    signedUrl: signed.data.signedUrl,
    revisionId: revision.data?.id ?? null,
    revisionNumber: revision.data?.revision_number ?? null,
    edit: parseEdit(revision.data?.edit_data),
  };
}
