import "server-only";

import { createClient } from "@/lib/supabase/server";

export type PatientRecordSummary = {
  treatmentId: string;
  treatmentName: string;
  clinicName: string;
  patientName: string;
  releasedSessions: number;
  sharedComparisons: number;
};

export type ReleasedPhoto = {
  id: string;
  label: string;
  previewUrl: string | null;
};

export type ReleasedComparison = {
  id: string;
  angleName: string;
  aligned: boolean;
  beforeUrl: string | null;
  afterUrl: string | null;
  x: number;
  y: number;
  rotation: number;
  scale: number;
};

export type ReleasedTreatment = {
  id: string;
  name: string;
  clinicName: string;
  sessions: { id: string; label: string; date: string; photos: ReleasedPhoto[] }[];
  comparisons: ReleasedComparison[];
};

export async function listPatientRecords(patientIds: string[]): Promise<PatientRecordSummary[]> {
  if (patientIds.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("treatments")
    .select("id, name, patients!inner(first_name, last_name, organizations(name))")
    .in("patient_id", patientIds)
    .order("name");

  if (error) {
    throw new Error("Could not load released records.");
  }

  const treatmentIds = (data ?? []).map((treatment) => treatment.id);
  if (treatmentIds.length === 0) {
    return [];
  }

  const [sessionsResult, comparisonsResult] = await Promise.all([
    supabase
      .from("photo_sessions")
      .select("treatment_id")
      .in("treatment_id", treatmentIds)
      .eq("status", "completed")
      .eq("released_to_patient", true),
    supabase
      .from("comparisons")
      .select("treatment_id")
      .in("treatment_id", treatmentIds)
      .eq("shared_with_patient", true)
      .is("revoked_at", null),
  ]);

  if (sessionsResult.error || comparisonsResult.error) {
    throw new Error("Could not load released records.");
  }

  return (data ?? []).flatMap((treatment) => {
    const patient = Array.isArray(treatment.patients) ? treatment.patients[0] : treatment.patients;
    const organization = patient
      ? Array.isArray(patient.organizations)
        ? patient.organizations[0]
        : patient.organizations
      : null;
    if (!patient || !organization) {
      return [];
    }
    const releasedSessions = (sessionsResult.data ?? []).filter((session) => session.treatment_id === treatment.id).length;
    const sharedComparisons = (comparisonsResult.data ?? []).filter((item) => item.treatment_id === treatment.id).length;
    if (releasedSessions === 0 && sharedComparisons === 0) {
      return [];
    }
    return [{
      treatmentId: treatment.id,
      treatmentName: treatment.name,
      clinicName: organization.name,
      patientName: `${patient.first_name} ${patient.last_name}`,
      releasedSessions,
      sharedComparisons,
    }];
  });
}

export async function getReleasedTreatment(treatmentId: string): Promise<ReleasedTreatment | null> {
  const supabase = await createClient();
  const { data: treatment, error } = await supabase
    .from("treatments")
    .select("id, name, patients!inner(organizations(name))")
    .eq("id", treatmentId)
    .maybeSingle();

  if (error || !treatment) {
    return null;
  }

  const patient = Array.isArray(treatment.patients) ? treatment.patients[0] : treatment.patients;
  const organization = patient
    ? Array.isArray(patient.organizations)
      ? patient.organizations[0]
      : patient.organizations
    : null;
  if (!organization) {
    return null;
  }

  const [sessionsResult, comparisonsResult] = await Promise.all([
    supabase
      .from("photo_sessions")
      .select("id, session_type, session_date, photos(id, storage_path, upload_status, photography_angles(name))")
      .eq("treatment_id", treatmentId)
      .eq("status", "completed")
      .eq("released_to_patient", true)
      .order("session_date", { ascending: false }),
    supabase
      .from("comparisons")
      .select("id, alignment, before:photos!comparisons_before_photo_id_fkey(storage_path, photography_angles(name)), after:photos!comparisons_after_photo_id_fkey(storage_path)")
      .eq("treatment_id", treatmentId)
      .eq("shared_with_patient", true)
      .is("revoked_at", null),
  ]);

  if (sessionsResult.error || comparisonsResult.error) {
    throw new Error("Could not load the released treatment.");
  }

  const paths = [
    ...(sessionsResult.data ?? []).flatMap((session) =>
      (session.photos ?? []).filter((photo) => photo.upload_status === "uploaded").map((photo) => photo.storage_path),
    ),
    ...(comparisonsResult.data ?? []).flatMap((item) => {
      const before = one(item.before);
      const after = one(item.after);
      return [before?.storage_path, after?.storage_path].filter((path): path is string => Boolean(path));
    }),
  ];
  const urls = await signedUrls(supabase, paths);

  return {
    id: treatment.id,
    name: treatment.name,
    clinicName: organization.name,
    sessions: (sessionsResult.data ?? []).map((session) => ({
      id: session.id,
      label: session.session_type === "baseline" ? "Baseline" : "Follow-up",
      date: session.session_date,
      photos: (session.photos ?? [])
        .filter((photo) => photo.upload_status === "uploaded")
        .map((photo) => {
          const angle = one(photo.photography_angles);
          return {
            id: photo.id,
            label: angle?.name ?? "Photograph",
            previewUrl: urls.get(photo.storage_path) ?? null,
          };
        }),
    })),
    comparisons: (comparisonsResult.data ?? []).map((item) => {
      const before = one(item.before);
      const after = one(item.after);
      const angle = before ? one(before.photography_angles) : null;
      const alignment = readAlignment(item.alignment);
      return {
        id: item.id,
        angleName: angle?.name ?? "Photograph",
        aligned: alignment.aligned,
        beforeUrl: before ? (urls.get(before.storage_path) ?? null) : null,
        afterUrl: after ? (urls.get(after.storage_path) ?? null) : null,
        x: alignment.x,
        y: alignment.y,
        rotation: alignment.rotation,
        scale: alignment.scale,
      };
    }),
  };
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function readAlignment(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { x: 0, y: 0, rotation: 0, scale: 1, aligned: false };
  }
  const record = value as Record<string, unknown>;
  return {
    x: typeof record.x === "number" ? record.x : 0,
    y: typeof record.y === "number" ? record.y : 0,
    rotation: typeof record.rotation === "number" ? record.rotation : 0,
    scale: typeof record.scale === "number" ? record.scale : 1,
    aligned: record.aligned === true,
  };
}

async function signedUrls(supabase: Awaited<ReturnType<typeof createClient>>, paths: string[]) {
  const urls = new Map<string, string>();
  await Promise.all(
    [...new Set(paths)].map(async (path) => {
      const { data } = await supabase.storage.from("clinical-photos").createSignedUrl(path, 180);
      if (data?.signedUrl) {
        urls.set(path, data.signedUrl);
      }
    }),
  );
  return urls;
}
