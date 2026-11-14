"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getWorkspace } from "@/features/access/workspace";
import {
  captureSettingsSchema,
  overrideReasonSchema,
  parseCaptureAssessment,
} from "@/features/capture/guidance/schema";
import { isUuid } from "@/lib/ids";
import { createClient } from "@/lib/supabase/server";

export async function recordCaptureQualityAction(input: {
  sessionId: string;
  photoId: string;
  assessment: unknown;
  overrideReason: string | null;
}): Promise<{ status: "saved" } | { status: "error"; message: string }> {
  if (!isUuid(input.sessionId) || !isUuid(input.photoId)) {
    return { status: "error", message: "The quality note could not be saved." };
  }
  const assessment = parseCaptureAssessment(input.assessment);
  if (!assessment) {
    return { status: "error", message: "The quality note could not be saved." };
  }
  const override = input.overrideReason ? overrideReasonSchema.safeParse(input.overrideReason) : null;
  if (assessment.status === "poor" && !override?.success) {
    return { status: "error", message: "Add a short reason for using this photograph." };
  }

  const workspace = await staffWorkspace();
  if (!workspace?.activeMembership) {
    return { status: "error", message: "The quality note could not be saved." };
  }

  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("photos")
    .select("id, session_id, upload_status")
    .eq("id", input.photoId)
    .eq("session_id", input.sessionId)
    .maybeSingle();
  if (!photo || photo.upload_status !== "uploaded") {
    return { status: "error", message: "The quality note could not be saved." };
  }

  const { data: saved, error } = await supabase
    .from("capture_quality_assessments")
    .insert({
      photo_id: photo.id,
      session_id: photo.session_id,
      schema_version: 1,
      status: assessment.status,
      detector: assessment.detector,
      detector_version: assessment.detectorVersion,
      warnings: [...assessment.warnings],
      metrics: assessment.metrics,
      instruction: assessment.instruction,
      created_by: workspace.user.id,
    })
    .select("id")
    .single();

  if (error || !saved) {
    return { status: "error", message: "The quality note could not be saved." };
  }

  if (override?.success) {
    const { error: overrideError } = await supabase.from("capture_quality_overrides").insert({
      assessment_id: saved.id,
      photo_id: photo.id,
      reason: override.data,
      created_by: workspace.user.id,
    });
    if (overrideError) {
      return { status: "error", message: "The photograph was saved. The reason could not be stored." };
    }
  }

  revalidatePath(`/capture/${input.sessionId}`);
  return { status: "saved" };
}

export async function saveCaptureSettingsAction(input: {
  guidanceEnabled: boolean;
}): Promise<{ status: "saved" } | { status: "error"; message: string }> {
  const parsed = captureSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "The guidance setting could not be saved." };
  }
  const workspace = await staffWorkspace();
  if (!workspace?.activeMembership || workspace.activeMembership.role !== "clinic_admin") {
    return { status: "error", message: "Only a clinic administrator can change guidance." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("organization_capture_settings").upsert({
    organization_id: workspace.activeMembership.organizationId,
    guidance_enabled: parsed.data.guidanceEnabled,
    schema_version: 1,
    updated_by: workspace.user.id,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    return { status: "error", message: "The guidance setting could not be saved." };
  }
  revalidatePath("/capture");
  return { status: "saved" };
}

async function staffWorkspace() {
  const workspace = await getWorkspace();
  if (!workspace) {
    redirect("/login");
  }
  if (workspace.kind !== "staff" || !workspace.activeMembership) {
    return null;
  }
  return workspace;
}
