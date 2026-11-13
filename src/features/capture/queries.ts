import "server-only";

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
  treatmentId: string;
  treatmentName: string;
  bodyArea: string;
  patientId: string;
  patientName: string;
  hasConsent: boolean;
  hasBaseline: boolean;
};

export type CapturePhoto = {
  id: string;
  angleId: string;
  previewUrl: string | null;
  capturedAt?: string | null;
};

export type CaptureSessionView = {
  id: string;
  status: "draft" | "completed" | "cancelled";
  sessionType: "baseline" | "follow_up";
  patientName: string;
  treatmentName: string;
  bodyArea: string;
  protocol: CaptureProtocol;
  photos: CapturePhoto[];
  references: CapturePhoto[];
  comparisons: { beforeId: string; afterId: string; x: number; y: number; rotation: number; scale: number }[];
};

const CONSENT_PURPOSE = "Clinical photography";

export async function listCaptureTargets(organizationId: string): Promise<CaptureTarget[]> {
  const supabase = await createClient();
  const [patientsResult, baselinesResult] = await Promise.all([
    supabase
      .from("patients")
      .select("id, first_name, last_name, treatments(id, name, body_area), consents(purpose, revoked_at)")
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

  const baselines = new Set((baselinesResult.data ?? []).map((row) => row.treatment_id));

  return (patientsResult.data ?? []).flatMap((patient) => {
    const hasConsent = (patient.consents ?? []).some(
      (consent) => consent.purpose === CONSENT_PURPOSE && consent.revoked_at === null,
    );
    const patientName = `${patient.first_name} ${patient.last_name}`;
    return (patient.treatments ?? []).map((treatment) => ({
      treatmentId: treatment.id,
      treatmentName: treatment.name,
      bodyArea: treatment.body_area,
      patientId: patient.id,
      patientName,
      hasConsent,
      hasBaseline: baselines.has(treatment.id),
    }));
  });
}

export async function getCaptureProtocol(): Promise<CaptureProtocol | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("photography_protocols")
    .select("id, code, version, name, photography_angles(id, code, name, sort_order, instructions)")
    .eq("code", "FACE_STANDARD")
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
    return assemble(data, treatment, patient, sessionProtocol, supabase);
  }

  return assemble(data, treatment, patient, protocol, supabase);
}

async function protocolById(protocolId: string): Promise<CaptureProtocol | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("photography_protocols")
    .select("id, code, version, name, photography_angles(id, code, name, sort_order, instructions)")
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
    photos: { id: string; angle_id: string; storage_path: string; upload_status: string }[];
  },
  treatment: { name: string; body_area: string },
  patient: { first_name: string; last_name: string },
  protocol: CaptureProtocol,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<CaptureSessionView> {
  const uploaded = data.photos.filter((photo) => photo.upload_status === "uploaded");
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
    ? await supabase.from("comparisons").select("before_photo_id, after_photo_id, alignment").in("after_photo_id", photoIds).order("created_at", { ascending: false })
    : { data: [] };
  const comparisons = (saved ?? []).flatMap((item) => {
    const value = item.alignment;
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const { x, y, rotation, scale } = value;
    if (typeof x !== "number" || typeof y !== "number" || typeof rotation !== "number" || typeof scale !== "number") return [];
    return [{ beforeId: item.before_photo_id, afterId: item.after_photo_id, x, y, rotation, scale }];
  });

  return {
    id: data.id,
    status: data.status,
    sessionType: data.session_type,
    patientName: `${patient.first_name} ${patient.last_name}`,
    treatmentName: treatment.name,
    bodyArea: treatment.body_area,
    protocol,
    comparisons,
    photos: uploaded.map((photo) => ({
      id: photo.id,
      angleId: photo.angle_id,
      previewUrl: previewUrls.get(photo.storage_path) ?? null,
    })),
    references: references.map((photo) => ({
      id: photo.id,
      angleId: photo.angle_id,
      previewUrl: previewUrls.get(photo.storage_path) ?? null,
      capturedAt: photo.captured_at,
    })),
  };
}

async function baselineReferences(
  supabase: Awaited<ReturnType<typeof createClient>>,
  treatmentId: string,
  currentSessionId: string,
) {
  const { data, error } = await supabase
    .from("photos")
    .select("id, angle_id, storage_path, captured_at, photo_sessions!inner(treatment_id, session_type, status)")
    .eq("upload_status", "uploaded")
    .eq("photo_sessions.treatment_id", treatmentId)
    .eq("photo_sessions.session_type", "baseline")
    .eq("photo_sessions.status", "completed")
    .neq("session_id", currentSessionId);

  if (error) {
    throw new Error("Could not load the baseline photographs.");
  }

  return (data ?? []).sort((left, right) => (right.captured_at ?? "").localeCompare(left.captured_at ?? ""));
}

async function signedUrls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paths: string[],
) {
  const unique = [...new Set(paths)];
  const urls = new Map<string, string>();

  await Promise.all(
    unique.map(async (path) => {
      const { data } = await supabase.storage.from("clinical-photos").createSignedUrl(path, 180);
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
