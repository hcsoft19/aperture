"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getWorkspace } from "@/features/access/workspace";
import {
  canRelease,
  releaseRequestSchema,
  revoke,
  revokeRequestSchema,
  visibleToPatient,
  type ProgressActionResult,
  type ReleaseCandidate,
} from "@/features/progress-gallery/model";
import { progressGalleryPath } from "@/features/progress-gallery/mount";
import {
  PROGRESS_RELEASE_COLUMNS,
  progressReleases,
  toProgressRelease,
} from "@/features/progress-gallery/table";
import { createClient } from "@/lib/supabase/server";

export async function releaseProgressAction(
  previousOrForm: ProgressActionResult | null | FormData,
  formData?: FormData,
): Promise<ProgressActionResult> {
  const fields = previousOrForm instanceof FormData ? previousOrForm : formData;
  if (!fields) {
    return { status: "error", message: "The release could not be saved." };
  }

  return releaseProgress(fields);
}

export async function revokeProgressAction(
  previousOrForm: ProgressActionResult | null | FormData,
  formData?: FormData,
): Promise<ProgressActionResult> {
  const fields = previousOrForm instanceof FormData ? previousOrForm : formData;
  if (!fields) {
    return { status: "error", message: "The release could not be revoked." };
  }

  return revokeProgress(fields);
}

async function releaseProgress(formData: FormData): Promise<ProgressActionResult> {
  const parsed = releaseRequestSchema.safeParse({
    patientId: textField(formData, "patientId"),
    comparisonId: textField(formData, "comparisonId"),
    derivativeId: textField(formData, "derivativeId"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Choose one comparison or one edited photograph.",
    };
  }

  const staff = await requireStaffClinic();
  if (!staff.ok) {
    return { status: "error", message: staff.message };
  }

  const supabase = await createClient();
  const patient = await patientInClinic(supabase, staff.organizationId, parsed.data.patientId);
  if ("status" in patient) {
    return patient;
  }

  const comparisonId = parsed.data.comparisonId.trim();
  const derivativeId = parsed.data.derivativeId.trim();
  const target = comparisonId
    ? await comparisonTarget(supabase, staff.organizationId, parsed.data.patientId, comparisonId)
    : await derivativeTarget(supabase, staff.organizationId, parsed.data.patientId, derivativeId);

  if ("status" in target) {
    return target;
  }

  const now = new Date();
  const existing = await progressReleases(supabase)
    .select(PROGRESS_RELEASE_COLUMNS)
    .eq("organization_id", staff.organizationId)
    .eq("patient_id", parsed.data.patientId)
    .eq(target.column, target.id)
    .order("created_at", { ascending: false });

  if (existing.error) {
    return { status: "error", message: "The release could not be saved." };
  }

  const alreadyVisible = (existing.data ?? []).some(
    (row) => visibleToPatient([toProgressRelease(row)], now).length > 0,
  );
  if (alreadyVisible) {
    return { status: "error", message: "This is already released to the patient." };
  }

  const { data, error } = await progressReleases(supabase)
    .insert({
      organization_id: staff.organizationId,
      patient_id: parsed.data.patientId,
      comparison_id: target.kind === "comparison" ? target.id : null,
      photo_id: null,
      derivative_id: target.kind === "derivative" ? target.id : null,
      released_by: staff.userId,
    })
    .select("id");

  if (error || !data?.length) {
    return { status: "error", message: "The release could not be saved." };
  }

  revalidateProgress(parsed.data.patientId);
  return {
    status: "success",
    message:
      target.kind === "comparison"
        ? "Comparison released to the patient."
        : "Edited photograph released to the patient.",
  };
}

async function revokeProgress(formData: FormData): Promise<ProgressActionResult> {
  const parsed = revokeRequestSchema.safeParse({
    patientId: textField(formData, "patientId"),
    releaseId: textField(formData, "releaseId"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "The release could not be revoked.",
    };
  }

  const staff = await requireStaffClinic();
  if (!staff.ok) {
    return { status: "error", message: staff.message };
  }

  const supabase = await createClient();
  const patient = await patientInClinic(supabase, staff.organizationId, parsed.data.patientId);
  if ("status" in patient) {
    return patient;
  }

  const { data, error } = await progressReleases(supabase)
    .select(PROGRESS_RELEASE_COLUMNS)
    .eq("id", parsed.data.releaseId)
    .eq("organization_id", staff.organizationId)
    .eq("patient_id", parsed.data.patientId)
    .maybeSingle();

  if (error || !data) {
    return { status: "error", message: "This release is not available." };
  }

  const now = new Date();
  const current = toProgressRelease(data);
  if (visibleToPatient([current], now).length === 0) {
    return { status: "error", message: "This release is already revoked." };
  }

  const revoked = revoke(current, now);
  if (!revoked.revokedAt) {
    return { status: "error", message: "The release could not be revoked." };
  }

  const update = await progressReleases(supabase)
    .update({ revoked_at: revoked.revokedAt })
    .eq("id", current.id)
    .eq("organization_id", staff.organizationId)
    .eq("patient_id", parsed.data.patientId)
    .is("revoked_at", null)
    .select("id");

  if (update.error || !update.data?.length) {
    return { status: "error", message: "The release could not be revoked." };
  }

  revalidateProgress(parsed.data.patientId);
  return { status: "success", message: "Release revoked." };
}

async function comparisonTarget(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  patientId: string,
  comparisonId: string,
): Promise<TargetResult> {
  const { data, error } = await supabase
    .from("comparisons")
    .select("id, revoked_at, treatments!inner(patient_id, patients!inner(organization_id))")
    .eq("id", comparisonId)
    .eq("treatments.patient_id", patientId)
    .eq("treatments.patients.organization_id", organizationId)
    .maybeSingle();

  if (error) {
    return { status: "error", message: "This comparison is not available." };
  }

  if (data && data.revoked_at === null && canRelease({ kind: "comparison", id: data.id })) {
    return { ok: true, kind: "comparison", id: data.id, column: "comparison_id" };
  }

  if (await originalInClinic(supabase, organizationId, patientId, comparisonId)) {
    return {
      status: "error",
      message: "Original photographs stay in the clinic record.",
    };
  }

  return { status: "error", message: "This comparison is not available." };
}

async function derivativeTarget(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  patientId: string,
  derivativeId: string,
): Promise<TargetResult> {
  const { data, error } = await supabase
    .from("photo_derivatives")
    .select(
      "id, storage_path, photos!inner(photo_sessions!inner(treatments!inner(patient_id, patients!inner(organization_id))))",
    )
    .eq("id", derivativeId)
    .eq("photos.photo_sessions.treatments.patient_id", patientId)
    .eq("photos.photo_sessions.treatments.patients.organization_id", organizationId)
    .maybeSingle();

  if (error) {
    return { status: "error", message: "This edited photograph is not available." };
  }

  if (data) {
    const candidate: ReleaseCandidate = {
      kind: "derivative",
      id: data.id,
      storagePath: data.storage_path,
    };
    if (!canRelease(candidate)) {
      return {
        status: "error",
        message: "Original photographs stay in the clinic record.",
      };
    }

    return { ok: true, kind: "derivative", id: data.id, column: "derivative_id" };
  }

  if (await originalInClinic(supabase, organizationId, patientId, derivativeId)) {
    return {
      status: "error",
      message: "Original photographs stay in the clinic record.",
    };
  }

  return { status: "error", message: "This edited photograph is not available." };
}

async function originalInClinic(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  patientId: string,
  photoId: string,
) {
  const { data, error } = await supabase
    .from("photos")
    .select(
      "id, storage_path, photo_sessions!inner(treatments!inner(patient_id, patients!inner(organization_id)))",
    )
    .eq("id", photoId)
    .eq("photo_sessions.treatments.patient_id", patientId)
    .eq("photo_sessions.treatments.patients.organization_id", organizationId)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return !canRelease({
    kind: "original",
    id: data.id,
    storagePath: data.storage_path,
  });
}

async function patientInClinic(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  patientId: string,
): Promise<ProgressActionResult | { ok: true }> {
  const { data, error } = await supabase
    .from("patients")
    .select("id")
    .eq("id", patientId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    return { status: "error", message: "This chart is not available." };
  }

  if (!data) {
    return { status: "error", message: "This chart is not available." };
  }

  return { ok: true };
}

type TargetResult =
  | {
      ok: true;
      kind: "comparison" | "derivative";
      id: string;
      column: "comparison_id" | "derivative_id";
    }
  | ProgressActionResult;

async function requireStaffClinic(): Promise<
  | { ok: true; organizationId: string; userId: string }
  | { ok: false; message: string }
> {
  const workspace = await getWorkspace();

  if (!workspace) {
    redirect("/login");
  }

  if (workspace.kind === "patient") {
    return {
      ok: false,
      message: "Patient charts are limited to professionals in a clinic.",
    };
  }

  if (workspace.kind !== "staff" || !workspace.activeMembership) {
    return {
      ok: false,
      message: "Create a clinic before opening patient charts.",
    };
  }

  return {
    ok: true,
    organizationId: workspace.activeMembership.organizationId,
    userId: workspace.user.id,
  };
}

function revalidateProgress(patientId: string) {
  revalidatePath(progressGalleryPath(patientId));
  revalidatePath(`/patients/${patientId}`);
}

function textField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}
