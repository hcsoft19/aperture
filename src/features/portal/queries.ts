import "server-only";

import { z } from "zod";

import type { ProgressRelease } from "@/features/progress-gallery/model";
import {
  releasedComparisonIds,
  visibleComparisonIdsForTreatment,
  type PortalComparisonCandidate,
} from "@/features/portal/patient-comparisons";
import { isUuid } from "@/lib/ids";
import { createClient } from "@/lib/supabase/server";

const comparisonColumns =
  "id, treatment_id, alignment, shared_with_patient, revoked_at, before:photos!comparisons_before_photo_id_fkey(storage_path, photography_angles(name)), after:photos!comparisons_after_photo_id_fkey(storage_path)" as const;

const DERIVATIVE_STORAGE_PATH =
  /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png)$/i;

const releasedEditSchema = z.array(
  z.object({
    treatmentId: z.string(),
    id: z.string(),
    storagePath: z.string(),
    angleName: z.string(),
  }),
);

type ReleasedEdit = {
  treatmentId: string;
  id: string;
  storagePath: string;
  angleName: string;
};

export type PatientRecordSummary = {
  treatmentId: string;
  treatmentName: string;
  clinicName: string;
  patientName: string;
  releasedSessions: number;
  sharedComparisons: number;
  releasedEdits: number;
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
  layout: "side_by_side" | "slider" | "stack";
  syncFraming: boolean;
  beforeZoom: number;
  afterZoom: number;
};

export type ReleasedTreatment = {
  id: string;
  name: string;
  clinicName: string;
  sessions: { id: string; label: string; date: string; photos: ReleasedPhoto[] }[];
  comparisons: ReleasedComparison[];
  edits: ReleasedPhoto[];
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

  const [sessionsResult, comparisonsResult, edits, releases] = await Promise.all([
    supabase
      .from("photo_sessions")
      .select("treatment_id")
      .in("treatment_id", treatmentIds)
      .eq("status", "completed")
      .eq("released_to_patient", true),
    supabase
      .from("comparisons")
      .select("id, treatment_id, shared_with_patient, revoked_at")
      .in("treatment_id", treatmentIds)
      .eq("shared_with_patient", true)
      .is("revoked_at", null),
    listReleasedEdits(supabase, "Could not load released records."),
    listComparisonReleases(supabase, patientIds, "Could not load released records."),
  ]);

  if (sessionsResult.error || comparisonsResult.error) {
    throw new Error("Could not load released records.");
  }

  const now = new Date();
  const sharedCandidates = (comparisonsResult.data ?? []).map(comparisonCandidate);
  const releasedCandidates = await comparisonCandidatesById(
    supabase,
    treatmentIds,
    releasedComparisonIds(releases, now).filter(
      (comparisonId) => !sharedCandidates.some((comparison) => comparison.id === comparisonId),
    ),
    "Could not load released records.",
  );
  const comparisonCandidates = [...sharedCandidates, ...releasedCandidates];

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
    const sharedComparisons = visibleComparisonIdsForTreatment(
      treatment.id,
      comparisonCandidates,
      releases,
      now,
    ).length;
    const releasedEdits = edits.filter((edit) => edit.treatmentId === treatment.id).length;
    if (releasedSessions === 0 && sharedComparisons === 0 && releasedEdits === 0) {
      return [];
    }
    return [{
      treatmentId: treatment.id,
      treatmentName: treatment.name,
      clinicName: organization.name,
      patientName: `${patient.first_name} ${patient.last_name}`,
      releasedSessions,
      sharedComparisons,
      releasedEdits,
    }];
  });
}

export async function getReleasedTreatment(treatmentId: string): Promise<ReleasedTreatment | null> {
  const supabase = await createClient();
  const { data: treatment, error } = await supabase
    .from("treatments")
    .select("id, name, patient_id, patients!inner(organizations(name))")
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

  const [sessionsResult, sharedComparisonsResult, edits, releases] = await Promise.all([
    supabase
      .from("photo_sessions")
      .select("id, session_type, session_date, photos(id, storage_path, upload_status, photography_angles(name))")
      .eq("treatment_id", treatmentId)
      .eq("status", "completed")
      .eq("released_to_patient", true)
      .order("session_date", { ascending: false }),
    supabase
      .from("comparisons")
      .select(comparisonColumns)
      .eq("treatment_id", treatmentId)
      .eq("shared_with_patient", true)
      .is("revoked_at", null),
    listReleasedEdits(supabase, "Could not load the released treatment."),
    listComparisonReleases(supabase, [treatment.patient_id], "Could not load the released treatment."),
  ]);

  if (sessionsResult.error || sharedComparisonsResult.error) {
    throw new Error("Could not load the released treatment.");
  }

  const now = new Date();
  const releasedComparisons = await treatmentComparisonsById(
    supabase,
    treatmentId,
    releasedComparisonIds(releases, now),
  );
  const comparisonRows = visibleTreatmentComparisons(
    treatmentId,
    [...(sharedComparisonsResult.data ?? []), ...releasedComparisons],
    releases,
    now,
  );
  const releasedEdits = edits.filter((edit) => edit.treatmentId === treatmentId);
  const paths = [
    ...(sessionsResult.data ?? []).flatMap((session) =>
      (session.photos ?? []).filter((photo) => photo.upload_status === "uploaded").map((photo) => photo.storage_path),
    ),
    ...comparisonRows.flatMap((item) => {
      const before = one(item.before);
      const after = one(item.after);
      return [before?.storage_path, after?.storage_path].filter((path): path is string => Boolean(path));
    }),
  ];
  const urls = await signedUrls(supabase, "clinical-photos", paths);
  const editUrls = await signedUrls(
    supabase,
    "photo-derivatives",
    releasedEdits.map((edit) => edit.storagePath),
  );

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
    comparisons: comparisonRows.map((item) => {
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
        layout: alignment.layout,
        syncFraming: alignment.syncFraming,
        beforeZoom: alignment.beforeZoom,
        afterZoom: alignment.afterZoom,
      };
    }),
    edits: releasedEdits.map((edit) => ({
      id: edit.id,
      label: editedPhotographLabel(edit.angleName),
      previewUrl: editUrls.get(edit.storagePath) ?? null,
    })),
  };
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function readAlignment(value: unknown): Pick<ReleasedComparison, "x" | "y" | "rotation" | "scale" | "aligned" | "layout" | "syncFraming" | "beforeZoom" | "afterZoom"> {
  const fallback = { x: 0, y: 0, rotation: 0, scale: 1, aligned: false, layout: "side_by_side" as const, syncFraming: false, beforeZoom: 1, afterZoom: 1 };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }
  const record = value as Record<string, unknown>;
  const layout = record.layout === "slider" || record.layout === "stack" || record.layout === "side_by_side" ? record.layout : "side_by_side";
  return {
    x: typeof record.x === "number" ? record.x : 0,
    y: typeof record.y === "number" ? record.y : 0,
    rotation: typeof record.rotation === "number" ? record.rotation : 0,
    scale: typeof record.scale === "number" ? record.scale : 1,
    aligned: record.aligned === true,
    layout,
    syncFraming: record.syncFraming === true,
    beforeZoom: typeof record.beforeZoom === "number" ? record.beforeZoom : 1,
    afterZoom: typeof record.afterZoom === "number" ? record.afterZoom : 1,
  };
}

function comparisonCandidate(row: {
  id: string;
  treatment_id: string;
  shared_with_patient: boolean;
  revoked_at: string | null;
}): PortalComparisonCandidate {
  return {
    id: row.id,
    treatmentId: row.treatment_id,
    sharedWithPatient: row.shared_with_patient,
    revokedAt: row.revoked_at,
  };
}

async function listComparisonReleases(
  supabase: Awaited<ReturnType<typeof createClient>>,
  patientIds: readonly string[],
  message: string,
): Promise<ProgressRelease[]> {
  const ids = [...new Set(patientIds)].filter((patientId) => isUuid(patientId));
  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("progress_releases")
    .select("id, organization_id, patient_id, comparison_id, photo_id, derivative_id, released_by, revoked_at, created_at")
    .in("patient_id", ids);

  if (error) {
    throw new Error(message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    patientId: row.patient_id,
    comparisonId: row.comparison_id,
    photoId: row.photo_id,
    derivativeId: row.derivative_id,
    releasedBy: row.released_by,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  }));
}

async function comparisonCandidatesById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  treatmentIds: readonly string[],
  comparisonIds: readonly string[],
  message: string,
): Promise<PortalComparisonCandidate[]> {
  if (treatmentIds.length === 0 || comparisonIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("comparisons")
    .select("id, treatment_id, shared_with_patient, revoked_at")
    .in("treatment_id", [...treatmentIds])
    .in("id", [...comparisonIds]);

  if (error) {
    throw new Error(message);
  }

  return (data ?? []).map(comparisonCandidate);
}

async function treatmentComparisonsById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  treatmentId: string,
  comparisonIds: readonly string[],
) {
  if (comparisonIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("comparisons")
    .select(comparisonColumns)
    .eq("treatment_id", treatmentId)
    .in("id", [...comparisonIds]);

  if (error) {
    throw new Error("Could not load the released treatment.");
  }

  return data ?? [];
}

function visibleTreatmentComparisons<T extends {
  id: string;
  treatment_id: string;
  shared_with_patient: boolean;
  revoked_at: string | null;
}>(
  treatmentId: string,
  rows: readonly T[],
  releases: readonly ProgressRelease[],
  now: Date,
): T[] {
  const visibleIds = new Set(
    visibleComparisonIdsForTreatment(treatmentId, rows.map(comparisonCandidate), releases, now),
  );
  const seen = new Set<string>();
  const visible: T[] = [];

  for (const row of rows) {
    if (!visibleIds.has(row.id) || seen.has(row.id)) {
      continue;
    }
    seen.add(row.id);
    visible.push(row);
  }

  return visible;
}

async function listReleasedEdits(
  supabase: Awaited<ReturnType<typeof createClient>>,
  message: string,
): Promise<ReleasedEdit[]> {
  const { data, error } = await supabase.rpc("patient_released_edits");
  if (error) {
    throw new Error(message);
  }

  const parsed = releasedEditSchema.safeParse(data ?? []);
  if (!parsed.success) {
    throw new Error(message);
  }

  return parsed.data.flatMap((edit) => {
    const storagePath = edit.storagePath.trim();
    const angleName = edit.angleName.trim();
    if (!isUuid(edit.treatmentId) || !isUuid(edit.id) || !DERIVATIVE_STORAGE_PATH.test(storagePath) || angleName.length === 0) {
      return [];
    }

    return [{
      treatmentId: edit.treatmentId,
      id: edit.id,
      storagePath,
      angleName,
    }];
  });
}

function editedPhotographLabel(angleName: string) {
  return angleName === "Photograph" ? "Edited photograph" : `Edited ${angleName} photograph`;
}

async function signedUrls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bucket: "clinical-photos" | "photo-derivatives",
  paths: string[],
) {
  const urls = new Map<string, string>();
  await Promise.all(
    [...new Set(paths)].map(async (path) => {
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 180);
      if (data?.signedUrl) {
        urls.set(path, data.signedUrl);
      }
    }),
  );
  return urls;
}
