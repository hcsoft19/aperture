import "server-only";

import { getVerifiedUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type CaptureAngle = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  instructions: string;
};

export type CaptureProtocol = {
  id: string;
  code: string;
  version: number;
  name: string;
  angles: CaptureAngle[];
};

export type CaptureTarget = {
  protocolCode?: string;
  treatmentId: string;
  treatmentName: string;
  bodyArea: string;
  patientId: string;
  patientName: string;
  hasConsent: boolean;
  hasBaseline: boolean;
};

export type CapturePhotoQuality = {
  status: "good" | "warning" | "poor" | "unavailable";
  instruction: string;
  warnings: string[];
  faceCenterX: number | null;
  faceCenterY: number | null;
  faceWidth: number | null;
  faceHeight: number | null;
};

export type CapturePhoto = {
  id: string;
  angleId: string;
  previewUrl: string | null;
  capturedAt?: string | null;
  quality: CapturePhotoQuality | null;
};

export type CaptureSessionView = {
  patientId?: string;
  treatmentId?: string;
  id: string;
  status: "draft" | "completed" | "cancelled";
  sessionType: "baseline" | "follow_up";
  patientName: string;
  treatmentName: string;
  bodyArea: string;
  protocol: CaptureProtocol;
  photos: CapturePhoto[];
  references: CapturePhoto[];
  guidanceEnabled: boolean;
  canManageGuidance: boolean;
  comparisons: {
    beforeId: string;
    afterId: string;
    x: number;
    y: number;
    rotation: number;
    scale: number;
    aligned: boolean;
  }[];
};

const CONSENT_PURPOSE = "Clinical photography";

export async function listCaptureTargets(
  organizationId: string,
): Promise<CaptureTarget[]> {
  const supabase = await createClient();
  const [patientsResult, baselinesResult] = await Promise.all([
    supabase
      .from("patients")
      .select(
        "id, first_name, last_name, treatments(id, name, body_area, protocol_code), consents(purpose, revoked_at)",
      )
      .eq("organization_id", organizationId)
      .order("last_name"),
    supabase
      .from("photo_sessions")
      .select("treatment_id, treatments!inner(patients!inner(organization_id))")
      .eq("session_type", "baseline")
      .eq("status", "completed")
      .eq("treatments.patients.organization_id", organizationId),
  ]);

  if (patientsResult.error || baselinesResult.error) {
    throw new Error("Could not load treatments.");
  }

  const baselines = new Set(
    (baselinesResult.data ?? []).map((row) => row.treatment_id),
  );

  return (patientsResult.data ?? []).flatMap((patient) => {
    const hasConsent = (patient.consents ?? []).some(
      (consent) =>
        consent.purpose === CONSENT_PURPOSE && consent.revoked_at === null,
    );
    const patientName = `${patient.first_name} ${patient.last_name}`;
    return (patient.treatments ?? []).map((treatment) => ({
      treatmentId: treatment.id,
      treatmentName: treatment.name,
      protocolCode: treatment.protocol_code,
      bodyArea: treatment.body_area,
      patientId: patient.id,
      patientName,
      hasConsent,
      hasBaseline: baselines.has(treatment.id),
    }));
  });
}

export async function getCaptureProtocol(
  code = "FACE_STANDARD",
): Promise<CaptureProtocol | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("photography_protocols")
    .select(
      "id, code, version, name, photography_angles(id, code, name, sort_order, instructions)",
    )
    .eq("code", code)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load the photography protocol.");
  }

  if (!data) {
    return null;
  }

  const angles = (data.photography_angles ?? [])
    .map((angle) => ({
      id: angle.id,
      code: angle.code,
      name: angle.name,
      sortOrder: angle.sort_order,
      instructions: angle.instructions,
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder);

  return {
    id: data.id,
    code: data.code,
    version: data.version,
    name: data.name,
    angles,
  };
}

export async function getCaptureSession(
  organizationId: string,
  sessionId: string,
): Promise<CaptureSessionView | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("photo_sessions")
    .select(
      "id, status, session_type, protocol_id, treatment_id, treatments!inner(name, body_area, patient_id, patients!inner(first_name, last_name, organization_id)), photos(id, angle_id, storage_path, upload_status)",
    )
    .eq("id", sessionId)
    .eq("treatments.patients.organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load the capture session.");
  }

  if (!data) {
    return null;
  }

  const treatment = one(data.treatments);
  const patient = treatment ? one(treatment.patients) : null;
  if (!treatment || !patient) {
    return null;
  }

  const protocol = await getCaptureProtocol();
  if (!protocol || protocol.id !== data.protocol_id) {
    const sessionProtocol = await protocolById(data.protocol_id);
    if (!sessionProtocol) {
      return null;
    }
    return assemble(data, treatment, patient, sessionProtocol, supabase, organizationId);
  }

  return assemble(data, treatment, patient, protocol, supabase, organizationId);
}

async function protocolById(
  protocolId: string,
): Promise<CaptureProtocol | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("photography_protocols")
    .select(
      "id, code, version, name, photography_angles(id, code, name, sort_order, instructions)",
    )
    .eq("id", protocolId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    code: data.code,
    version: data.version,
    name: data.name,
    angles: (data.photography_angles ?? [])
      .map((angle) => ({
        id: angle.id,
        code: angle.code,
        name: angle.name,
        sortOrder: angle.sort_order,
        instructions: angle.instructions,
      }))
      .sort((left, right) => left.sortOrder - right.sortOrder),
  };
}

async function assemble(
  data: {
    id: string;
    status: "draft" | "completed" | "cancelled";
    session_type: "baseline" | "follow_up";
    treatment_id: string;
    photos: {
      id: string;
      angle_id: string;
      storage_path: string;
      upload_status: string;
    }[];
  },
  treatment: { name: string; body_area: string; patient_id: string },
  patient: { first_name: string; last_name: string },
  protocol: CaptureProtocol,
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
): Promise<CaptureSessionView> {
  const uploaded = data.photos.filter(
    (photo) => photo.upload_status === "uploaded",
  );
  const references =
    data.session_type === "follow_up"
      ? await baselineReferences(supabase, data.treatment_id, data.id)
      : [];
  const previewUrls = await signedUrls(supabase, [
    ...uploaded.map((photo) => photo.storage_path),
    ...references.map((photo) => photo.storage_path),
  ]);
  const photoIds = uploaded.map((photo) => photo.id);
  const { data: saved } = photoIds.length
    ? await supabase
        .from("comparisons")
        .select("before_photo_id, after_photo_id, alignment")
        .in("after_photo_id", photoIds)
        .order("created_at", { ascending: false })
    : { data: [] };
  const comparisons = (saved ?? []).flatMap((item) => {
    const value = item.alignment;
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const { x, y, rotation, scale, aligned } = value;
    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      typeof rotation !== "number" ||
      typeof scale !== "number"
    )
      return [];
    return [
      {
        beforeId: item.before_photo_id,
        afterId: item.after_photo_id,
        x,
        y,
        rotation,
        scale,
        aligned: aligned === true,
      },
    ];
  });
  const quality = await loadCaptureQuality(
    supabase,
    organizationId,
    [...uploaded.map((photo) => photo.id), ...references.map((photo) => photo.id)],
  );

  return {
    id: data.id,
    status: data.status,
    sessionType: data.session_type,
    patientId: treatment.patient_id,
    treatmentId: data.treatment_id,
    patientName: `${patient.first_name} ${patient.last_name}`,
    treatmentName: treatment.name,
    bodyArea: treatment.body_area,
    protocol,
    comparisons,
    photos: uploaded.map((photo) => ({
      id: photo.id,
      angleId: photo.angle_id,
      previewUrl: previewUrls.get(photo.storage_path) ?? null,
      quality: quality.byPhoto.get(photo.id) ?? null,
    })),
    references: references.map((photo) => ({
      id: photo.id,
      angleId: photo.angle_id,
      previewUrl: previewUrls.get(photo.storage_path) ?? null,
      capturedAt: photo.captured_at,
      quality: quality.byPhoto.get(photo.id) ?? null,
    })),
    guidanceEnabled: quality.guidanceEnabled,
    canManageGuidance: quality.canManageGuidance,
  };
}

async function loadCaptureQuality(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  photoIds: string[],
) {
  const user = await getVerifiedUser();
  const [settings, membership, assessments] = await Promise.all([
    supabase
      .from("organization_capture_settings")
      .select("guidance_enabled")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    user
      ? supabase
          .from("organization_members")
          .select("role")
          .eq("organization_id", organizationId)
          .eq("profile_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    photoIds.length
      ? supabase
          .from("capture_quality_assessments")
          .select("photo_id, status, instruction, warnings, metrics")
          .in("photo_id", photoIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const byPhoto = new Map<string, CapturePhotoQuality>();
  for (const row of assessments.data ?? []) {
    const metrics = row.metrics;
    if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) {
      continue;
    }
    const record = metrics as Record<string, unknown>;
    if (row.status !== "good" && row.status !== "warning" && row.status !== "poor" && row.status !== "unavailable") {
      continue;
    }
    byPhoto.set(row.photo_id, {
      status: row.status,
      instruction: row.instruction,
      warnings: Array.isArray(row.warnings) ? row.warnings.filter((item) => typeof item === "string") : [],
      faceCenterX: typeof record.faceCenterX === "number" ? record.faceCenterX : null,
      faceCenterY: typeof record.faceCenterY === "number" ? record.faceCenterY : null,
      faceWidth: typeof record.faceWidth === "number" ? record.faceWidth : null,
      faceHeight: typeof record.faceHeight === "number" ? record.faceHeight : null,
    });
  }
  return {
    byPhoto,
    guidanceEnabled: settings.data?.guidance_enabled !== false,
    canManageGuidance: membership.data?.role === "clinic_admin",
  };
}

async function baselineReferences(
  supabase: Awaited<ReturnType<typeof createClient>>,
  treatmentId: string,
  currentSessionId: string,
) {
  const { data, error } = await supabase
    .from("photos")
    .select(
      "id, angle_id, storage_path, captured_at, photo_sessions!inner(treatment_id, session_type, status)",
    )
    .eq("upload_status", "uploaded")
    .eq("photo_sessions.treatment_id", treatmentId)
    .eq("photo_sessions.session_type", "baseline")
    .eq("photo_sessions.status", "completed")
    .neq("session_id", currentSessionId);

  if (error) {
    throw new Error("Could not load the baseline photographs.");
  }

  return (data ?? []).sort((left, right) =>
    (right.captured_at ?? "").localeCompare(left.captured_at ?? ""),
  );
}

async function signedUrls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paths: string[],
) {
  const unique = [...new Set(paths)];
  const urls = new Map<string, string>();

  await Promise.all(
    unique.map(async (path) => {
      const { data } = await supabase.storage
        .from("clinical-photos")
        .createSignedUrl(path, 180);
      if (data?.signedUrl) {
        urls.set(path, data.signedUrl);
      }
    }),
  );

  return urls;
}

function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

export { CONSENT_PURPOSE };
