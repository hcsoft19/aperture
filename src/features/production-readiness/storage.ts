import { admitPhotograph, measureUsage, PROTOTYPE_STORAGE_LIMIT_BYTES } from "@/features/clinic-usage/usage";
import type { StoredPhotograph } from "@/features/clinic-usage/schema";
import { createClient } from "@/lib/supabase/server";

export async function loadClinicPhotographs(organizationId: string): Promise<StoredPhotograph[] | null> {
  const supabase = await createClient();
  const patients = await supabase.from("patients").select("id").eq("organization_id", organizationId);
  if (patients.error) {
    return null;
  }
  const patientIds = (patients.data ?? []).map((row) => row.id);
  if (patientIds.length === 0) {
    return [];
  }

  const treatments = await supabase.from("treatments").select("id").in("patient_id", patientIds);
  if (treatments.error) {
    return null;
  }
  const treatmentIds = (treatments.data ?? []).map((row) => row.id);
  if (treatmentIds.length === 0) {
    return [];
  }

  const sessions = await supabase.from("photo_sessions").select("id").in("treatment_id", treatmentIds);
  if (sessions.error) {
    return null;
  }
  const sessionIds = (sessions.data ?? []).map((row) => row.id);
  if (sessionIds.length === 0) {
    return [];
  }

  const photos = await supabase.from("photos").select("id, file_size_bytes").in("session_id", sessionIds);
  if (photos.error) {
    return null;
  }

  return (photos.data ?? []).map((row) => ({
    id: row.id,
    organizationId,
    fileSizeBytes: row.file_size_bytes,
  }));
}

export async function storageStatus(organizationId: string) {
  const photographs = await loadClinicPhotographs(organizationId);
  if (!photographs) {
    return null;
  }
  const measured = measureUsage({
    organizationId,
    photographs,
    limitBytes: PROTOTYPE_STORAGE_LIMIT_BYTES,
  });
  return measured.ok ? measured.usage : null;
}

export async function photographFitsQuota(input: {
  organizationId: string;
  photoId: string;
  fileSizeBytes: number;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const photographs = await loadClinicPhotographs(input.organizationId);
  if (!photographs) {
    return { ok: false, message: "Storage use could not be checked." };
  }
  const decision = admitPhotograph({
    organizationId: input.organizationId,
    photographs,
    limitBytes: PROTOTYPE_STORAGE_LIMIT_BYTES,
    incoming: {
      id: input.photoId,
      organizationId: input.organizationId,
      fileSizeBytes: input.fileSizeBytes,
    },
  });
  if (!decision.ok) {
    return { ok: false, message: "Storage use could not be checked." };
  }
  if (!decision.accepted) {
    return { ok: false, message: decision.message };
  }
  return { ok: true };
}
