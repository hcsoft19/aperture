"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getWorkspace } from "@/features/access/workspace";
import {
  CONSENT_PURPOSE,
  getCaptureProtocol,
} from "@/features/capture/queries";
import {
  canCancelSession,
  canFinishSession,
  clinicalStoragePath,
} from "@/features/capture/rules";
import {
  finishSessionSchema,
  preparePhotoSchema,
  startCaptureSchema,
  type PreparePhotoValues,
  type StartCaptureValues,
} from "@/features/capture/schemas";
import { isUuid } from "@/lib/ids";
import { createClient } from "@/lib/supabase/server";

export type CaptureActionResult = { status: "error"; message: string };

const BUCKET = "clinical-photos";

async function requireStaffClinic() {
  const workspace = await getWorkspace();

  if (!workspace) {
    redirect("/login");
  }

  if (workspace.kind !== "staff" || !workspace.activeMembership) {
    return null;
  }

  return workspace;
}

export async function startCaptureAction(
  values: StartCaptureValues,
): Promise<CaptureActionResult> {
  const parsed = startCaptureSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ?? "Choose a treatment and try again.",
    };
  }

  const workspace = await requireStaffClinic();
  if (!workspace?.activeMembership) {
    return {
      status: "error",
      message: "The camera is limited to professionals in a clinic.",
    };
  }

  const supabase = await createClient();
  const organizationId = workspace.activeMembership.organizationId;
  const { data: treatment, error: treatmentError } = await supabase
    .from("treatments")
    .select(
      "id, body_area, patient_id, protocol_code, patients!inner(id, organization_id)",
    )
    .eq("id", parsed.data.treatmentId)
    .eq("patients.organization_id", organizationId)
    .maybeSingle();

  if (treatmentError || !treatment) {
    return { status: "error", message: "That treatment is not available." };
  }

  if (parsed.data.sessionType === "follow_up") {
    const { count, error } = await supabase
      .from("photo_sessions")
      .select("id", { count: "exact", head: true })
      .eq("treatment_id", treatment.id)
      .eq("session_type", "baseline")
      .eq("status", "completed");

    if (error || !count) {
      return {
        status: "error",
        message: "Finish a baseline session before a follow-up.",
      };
    }
  }

  const { data: consents, error: consentError } = await supabase
    .from("consents")
    .select("id")
    .eq("patient_id", treatment.patient_id)
    .eq("organization_id", organizationId)
    .eq("purpose", CONSENT_PURPOSE)
    .is("revoked_at", null)
    .limit(1);

  if (consentError) {
    return { status: "error", message: "The session could not be started." };
  }

  if (!consents?.length) {
    if (!parsed.data.confirmConsent) {
      return {
        status: "error",
        message: "Record photography consent before capturing.",
      };
    }

    const { error } = await supabase.from("consents").insert({
      patient_id: treatment.patient_id,
      organization_id: organizationId,
      granted_by: workspace.user.id,
      purpose: CONSENT_PURPOSE,
    });

    if (error) {
      return {
        status: "error",
        message: "Photography consent could not be recorded.",
      };
    }
  }

  const protocol = await getCaptureProtocol(treatment.protocol_code);
  if (!protocol || protocol.angles.length === 0) {
    return {
      status: "error",
      message: "The photography protocol is not available.",
    };
  }

  const { data: session, error: sessionError } = await supabase
    .from("photo_sessions")
    .insert({
      treatment_id: treatment.id,
      session_type: parsed.data.sessionType,
      protocol_id: protocol.id,
      session_date: new Date().toISOString().slice(0, 10),
      created_by: workspace.user.id,
      status: "draft",
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    return { status: "error", message: "The session could not be started." };
  }

  revalidatePath("/capture");
  redirect(`/capture/${session.id}`);
}

export async function preparePhotoAction(
  values: PreparePhotoValues,
): Promise<
  | CaptureActionResult
  | { status: "ready"; photoId: string; storagePath: string }
> {
  const parsed = preparePhotoSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ?? "The photograph could not be saved.",
    };
  }

  if (Math.min(parsed.data.width, parsed.data.height) < 1000) {
    return {
      status: "error",
      message: "Use a photograph at least 1000 pixels on the shortest side.",
    };
  }

  const workspace = await requireStaffClinic();
  if (!workspace?.activeMembership) {
    return {
      status: "error",
      message: "The camera is limited to professionals in a clinic.",
    };
  }

  const supabase = await createClient();
  const context = await loadDraft(
    supabase,
    parsed.data.sessionId,
    workspace.activeMembership.organizationId,
  );

  if (!context) {
    return {
      status: "error",
      message: "This session is not open for photographs.",
    };
  }

  if (!context.angleIds.has(parsed.data.angleId)) {
    return {
      status: "error",
      message: "That angle is not part of this session.",
    };
  }

  if (parsed.data.referencePhotoId) {
    const referenceOk = await referenceMatches(
      supabase,
      parsed.data.referencePhotoId,
      parsed.data.angleId,
      context.treatmentId,
    );
    if (!referenceOk || context.sessionType !== "follow_up") {
      return {
        status: "error",
        message: "The reference photograph is not available.",
      };
    }
  }

  await removePending(supabase, parsed.data.sessionId, parsed.data.angleId);

  const photoId = crypto.randomUUID();
  const storagePath = clinicalStoragePath({
    organizationId: workspace.activeMembership.organizationId,
    patientId: context.patientId,
    sessionId: parsed.data.sessionId,
    angleId: parsed.data.angleId,
    photoId,
    mimeType: parsed.data.mimeType,
  });

  const { error } = await supabase.from("photos").insert({
    id: photoId,
    session_id: parsed.data.sessionId,
    angle_id: parsed.data.angleId,
    body_area: context.bodyArea,
    storage_path: storagePath,
    source: parsed.data.source,
    captured_at: new Date().toISOString(),
    captured_by: workspace.user.id,
    width: parsed.data.width,
    height: parsed.data.height,
    mime_type: parsed.data.mimeType,
    file_size_bytes: parsed.data.fileSizeBytes,
    sha256: parsed.data.sha256,
    reference_photo_id: parsed.data.referencePhotoId,
    camera_facing: parsed.data.cameraFacing,
    overlay_opacity: parsed.data.overlayOpacity,
    upload_status: "pending",
  });

  if (error) {
    return { status: "error", message: "The photograph could not be saved." };
  }

  return { status: "ready", photoId, storagePath };
}

export async function finalizePhotoAction(input: {
  sessionId: string;
  photoId: string;
}): Promise<CaptureActionResult | { status: "saved" }> {
  if (!isUuid(input.sessionId) || !isUuid(input.photoId)) {
    return { status: "error", message: "The photograph could not be saved." };
  }

  const workspace = await requireStaffClinic();
  if (!workspace?.activeMembership) {
    return {
      status: "error",
      message: "The camera is limited to professionals in a clinic.",
    };
  }

  const supabase = await createClient();
  const context = await loadDraft(
    supabase,
    input.sessionId,
    workspace.activeMembership.organizationId,
  );
  if (!context) {
    return {
      status: "error",
      message: "This session is not open for photographs.",
    };
  }

  const { data: photo, error } = await supabase
    .from("photos")
    .select("id, storage_path, file_size_bytes, upload_status")
    .eq("id", input.photoId)
    .eq("session_id", input.sessionId)
    .maybeSingle();

  if (error || !photo || photo.upload_status !== "pending") {
    return { status: "error", message: "The photograph could not be saved." };
  }

  const stored = await storedObject(supabase, photo.storage_path);
  const storedSize = storedSizeBytes(stored);
  if (!stored || storedSize !== photo.file_size_bytes) {
    await removePending(supabase, input.sessionId, undefined, input.photoId);
    return {
      status: "error",
      message: "The photograph could not be confirmed.",
    };
  }

  const { data: updated, error: updateError } = await supabase
    .from("photos")
    .update({
      upload_status: "uploaded",
      uploaded_at: new Date().toISOString(),
    })
    .eq("id", photo.id)
    .eq("upload_status", "pending")
    .select("id");

  if (updateError || !updated?.length) {
    return { status: "error", message: "The photograph could not be saved." };
  }

  revalidatePath(`/capture/${input.sessionId}`);
  return { status: "saved" };
}

export async function discardPhotoAction(input: {
  sessionId: string;
  photoId: string;
}): Promise<void> {
  if (!isUuid(input.sessionId) || !isUuid(input.photoId)) {
    return;
  }

  const workspace = await requireStaffClinic();
  if (!workspace?.activeMembership) {
    return;
  }

  const supabase = await createClient();
  const context = await loadDraft(
    supabase,
    input.sessionId,
    workspace.activeMembership.organizationId,
  );
  if (!context) {
    return;
  }

  await removePending(supabase, input.sessionId, undefined, input.photoId);
}

export async function finishCaptureAction(input: {
  sessionId: string;
  missingReason: string;
}): Promise<CaptureActionResult> {
  const parsed = finishSessionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ?? "The session could not be finished.",
    };
  }

  const workspace = await requireStaffClinic();
  if (!workspace?.activeMembership) {
    return {
      status: "error",
      message: "The camera is limited to professionals in a clinic.",
    };
  }

  const supabase = await createClient();
  const context = await loadDraft(
    supabase,
    parsed.data.sessionId,
    workspace.activeMembership.organizationId,
  );
  if (!context) {
    return { status: "error", message: "This session is not open." };
  }

  const message = canFinishSession({
    uploadedCount: context.uploadedCount,
    angleCount: context.angleIds.size,
    missingReason: parsed.data.missingReason,
  });

  if (message) {
    return { status: "error", message };
  }

  const { data, error } = await supabase
    .from("photo_sessions")
    .update({
      status: "completed",
      missing_angles_reason:
        context.uploadedCount < context.angleIds.size
          ? parsed.data.missingReason.trim()
          : null,
    })
    .eq("id", parsed.data.sessionId)
    .eq("status", "draft")
    .select("id");

  if (error || !data?.length) {
    return { status: "error", message: "The session could not be finished." };
  }

  revalidatePath(`/capture/${parsed.data.sessionId}`);
  revalidatePath(`/patients/${context.patientId}`);
  revalidatePath("/patients", "layout");
  revalidatePath("/home");
  revalidatePath("/clinic");
  redirect(`/capture/${parsed.data.sessionId}`);
}

export async function cancelCaptureAction(input: {
  sessionId: string;
  missingReason: string;
}): Promise<CaptureActionResult> {
  const parsed = finishSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "The session could not be cancelled." };
  }

  const workspace = await requireStaffClinic();
  if (!workspace?.activeMembership) {
    return {
      status: "error",
      message: "The camera is limited to professionals in a clinic.",
    };
  }

  const supabase = await createClient();
  const context = await loadDraft(
    supabase,
    parsed.data.sessionId,
    workspace.activeMembership.organizationId,
  );
  if (!context) {
    return { status: "error", message: "This session is not open." };
  }

  const message = canCancelSession({
    uploadedCount: context.uploadedCount,
    missingReason: parsed.data.missingReason,
  });
  if (message) {
    return { status: "error", message };
  }

  if (context.uploadedCount === 0) {
    await removePending(supabase, parsed.data.sessionId);
    const { error } = await supabase
      .from("photo_sessions")
      .delete()
      .eq("id", parsed.data.sessionId)
      .eq("status", "draft");
    if (error) {
      return {
        status: "error",
        message: "The session could not be cancelled.",
      };
    }
    revalidatePath("/capture");
    redirect("/capture");
  }

  const { data, error } = await supabase
    .from("photo_sessions")
    .update({
      status: "cancelled",
      missing_angles_reason: parsed.data.missingReason.trim(),
    })
    .eq("id", parsed.data.sessionId)
    .eq("status", "draft")
    .select("id");

  if (error || !data?.length) {
    return { status: "error", message: "The session could not be cancelled." };
  }

  revalidatePath(`/capture/${parsed.data.sessionId}`);
  redirect(`/capture/${parsed.data.sessionId}`);
}

type DraftContext = {
  patientId: string;
  treatmentId: string;
  bodyArea: string;
  sessionType: "baseline" | "follow_up";
  angleIds: Set<string>;
  uploadedCount: number;
};

async function loadDraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  organizationId: string,
): Promise<DraftContext | null> {
  const { data, error } = await supabase
    .from("photo_sessions")
    .select(
      "id, status, session_type, protocol_id, treatments!inner(id, body_area, patient_id, protocol_code, patients!inner(organization_id)), photos(id, upload_status)",
    )
    .eq("id", sessionId)
    .eq("status", "draft")
    .eq("treatments.patients.organization_id", organizationId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const treatment = Array.isArray(data.treatments)
    ? data.treatments[0]
    : data.treatments;
  if (!treatment) {
    return null;
  }

  const { data: angles, error: angleError } = await supabase
    .from("photography_angles")
    .select("id")
    .eq("protocol_id", data.protocol_id);

  if (angleError) {
    return null;
  }

  return {
    patientId: treatment.patient_id,
    treatmentId: treatment.id,
    bodyArea: treatment.body_area,
    sessionType: data.session_type,
    angleIds: new Set((angles ?? []).map((angle) => angle.id)),
    uploadedCount: (data.photos ?? []).filter(
      (photo) => photo.upload_status === "uploaded",
    ).length,
  };
}

async function referenceMatches(
  supabase: Awaited<ReturnType<typeof createClient>>,
  photoId: string,
  angleId: string,
  treatmentId: string,
) {
  const { data, error } = await supabase
    .from("photos")
    .select("id, photo_sessions!inner(treatment_id, session_type, status)")
    .eq("id", photoId)
    .eq("angle_id", angleId)
    .eq("upload_status", "uploaded")
    .eq("photo_sessions.treatment_id", treatmentId)
    .eq("photo_sessions.session_type", "baseline")
    .eq("photo_sessions.status", "completed")
    .maybeSingle();

  return !error && Boolean(data);
}

async function removePending(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  angleId?: string,
  photoId?: string,
) {
  let query = supabase
    .from("photos")
    .select("id, storage_path")
    .eq("session_id", sessionId)
    .eq("upload_status", "pending");

  if (angleId) {
    query = query.eq("angle_id", angleId);
  }
  if (photoId) {
    query = query.eq("id", photoId);
  }

  const { data } = await query;
  const paths = (data ?? []).map((photo) => photo.storage_path);
  if (paths.length > 0) {
    await supabase.storage.from(BUCKET).remove(paths);
  }

  if ((data ?? []).length > 0) {
    await supabase
      .from("photos")
      .delete()
      .in(
        "id",
        (data ?? []).map((photo) => photo.id),
      )
      .eq("upload_status", "pending");
  }
}

async function storedObject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storagePath: string,
) {
  const parts = storagePath.split("/");
  const fileName = parts.at(-1);
  const folder = parts.slice(0, -1).join("/");
  if (!fileName) {
    return null;
  }

  const { data, error } = await supabase.storage.from(BUCKET).list(folder, {
    limit: 20,
    search: fileName,
  });

  if (error) {
    return null;
  }

  return data?.find((entry) => entry.name === fileName) ?? null;
}

function storedSizeBytes(
  entry: { metadata?: Record<string, unknown> | null } | null,
) {
  const size = entry?.metadata?.size;
  if (typeof size === "number" && Number.isFinite(size)) {
    return size;
  }
  if (typeof size === "string" && /^\d+$/.test(size)) {
    return Number(size);
  }
  return null;
}
