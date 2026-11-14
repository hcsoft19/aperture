import "server-only";

import { createClient } from "@/lib/supabase/server";
import { parseEdit, type EditDocument } from "@/features/editor/schema";
import type { FaceBox } from "@/features/photo-intelligence/framing/suggest";

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
  face: FaceBox;
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
  const assessment = await supabase
    .from("capture_quality_assessments")
    .select("metrics")
    .eq("photo_id", photoId)
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
    face: faceFromMetrics(assessment.data?.metrics),
  };
}

function faceFromMetrics(metrics: unknown): FaceBox {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) {
    return null;
  }
  const record = metrics as Record<string, unknown>;
  const centerX = record.faceCenterX;
  const centerY = record.faceCenterY;
  const width = record.faceWidth;
  const height = record.faceHeight;
  if (
    typeof centerX !== "number" ||
    typeof centerY !== "number" ||
    typeof width !== "number" ||
    typeof height !== "number"
  ) {
    return null;
  }
  return { centerX, centerY, width, height };
}
