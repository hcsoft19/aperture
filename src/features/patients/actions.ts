"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getWorkspace } from "@/features/access/workspace";
import { scheduleReminder } from "@/features/follow-ups/reminders";
import { followUpReminders } from "@/features/follow-ups/table";
import {
  patientSchema,
  treatmentSchema,
  type PatientValues,
  type TreatmentValues,
} from "@/features/patients/schemas";
import { isUuid } from "@/lib/ids";
import { createClient } from "@/lib/supabase/server";

export type ChartActionResult = { status: "error"; message: string };

function blankToNull(value: string) {
  return value.length === 0 ? null : value;
}

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

export async function createPatientAction(
  values: PatientValues,
): Promise<ChartActionResult> {
  const parsed = patientSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ?? "Check the chart and try again.",
    };
  }

  const workspace = await requireStaffClinic();
  if (!workspace?.activeMembership) {
    return {
      status: "error",
      message: "Patient charts are limited to professionals in a clinic.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .insert({
      organization_id: workspace.activeMembership.organizationId,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      date_of_birth: blankToNull(parsed.data.dateOfBirth),
      contact_email: blankToNull(parsed.data.contactEmail),
      phone: blankToNull(parsed.data.phone),
      gender: parsed.data.gender || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { status: "error", message: "The chart could not be saved." };
  }

  revalidatePath("/home");
  revalidatePath("/patients");
  redirect(`/patients/${data.id}`);
}

export async function updatePatientAction(
  patientId: string,
  values: PatientValues,
): Promise<ChartActionResult> {
  const parsed = patientSchema.safeParse(values);

  if (!parsed.success || !isUuid(patientId)) {
    return {
      status: "error",
      message: parsed.success
        ? "The chart could not be saved."
        : (parsed.error.issues[0]?.message ?? "Check the chart and try again."),
    };
  }

  const workspace = await requireStaffClinic();
  if (!workspace?.activeMembership) {
    return {
      status: "error",
      message: "Patient charts are limited to professionals in a clinic.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      date_of_birth: blankToNull(parsed.data.dateOfBirth),
      contact_email: blankToNull(parsed.data.contactEmail),
      phone: blankToNull(parsed.data.phone),
      gender: parsed.data.gender || null,
    })
    .eq("id", patientId)
    .eq("organization_id", workspace.activeMembership.organizationId)
    .select("id");

  if (error || !data?.length) {
    return { status: "error", message: "The chart could not be saved." };
  }

  revalidatePath("/home");
  revalidatePath("/patients");
  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}`);
}

export async function createTreatmentAction(
  patientId: string,
  values: TreatmentValues,
  followUpDays?: number | null,
): Promise<ChartActionResult> {
  const parsed = treatmentSchema.safeParse(values);
  const plannedFollowUp = plannedFollowUpDays(followUpDays);

  if (!parsed.success || !isUuid(patientId) || plannedFollowUp === "invalid") {
    return {
      status: "error",
      message: parsed.success
        ? plannedFollowUp === "invalid"
          ? "Enter between 1 and 3650 days."
          : "The treatment could not be saved."
        : (parsed.error.issues[0]?.message ??
          "Check the treatment and try again."),
    };
  }

  const workspace = await requireStaffClinic();
  if (!workspace?.activeMembership) {
    return {
      status: "error",
      message: "Patient charts are limited to professionals in a clinic.",
    };
  }

  const supabase = await createClient();
  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id")
    .eq("id", patientId)
    .eq("organization_id", workspace.activeMembership.organizationId)
    .maybeSingle();

  if (patientError || !patient) {
    return { status: "error", message: "The treatment could not be saved." };
  }

  const { data, error } = await supabase
    .from("treatments")
    .insert({
      patient_id: patientId,
      name: parsed.data.name,
      category: parsed.data.category,
      procedure_type: parsed.data.procedureType ?? "",
      product_name: parsed.data.productName ?? "",
      protocol_code: parsed.data.protocolCode ?? "FACE_STANDARD",
      body_area: parsed.data.bodyArea,
      description: blankToNull(parsed.data.description),
      start_date: blankToNull(parsed.data.startDate),
      status: parsed.data.status,
      created_by: workspace.user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { status: "error", message: "The treatment could not be saved." };
  }

  if (plannedFollowUp !== null) {
    try {
      const fromDate =
        parsed.data.startDate.length > 0
          ? parsed.data.startDate
          : new Date().toISOString().slice(0, 10);
      const scheduled = scheduleReminder({
        treatmentId: data.id,
        fromDate,
        followUpDays: plannedFollowUp,
      });
      const { error: reminderError } = await followUpReminders(supabase).insert({
        organization_id: workspace.activeMembership.organizationId,
        treatment_id: data.id,
        due_on: scheduled.dueOn,
        note: null,
        created_by: workspace.user.id,
      });
      if (!reminderError) {
        revalidatePath("/clinic/reminders");
      }
    } catch {
      // The new treatment is already saved. Leave it in place.
    }
  }

  revalidatePath("/home");
  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}/treatments/${data.id}`);
}

function plannedFollowUpDays(value: number | null | undefined) {
  if (value == null) {
    return null;
  }

  if (!Number.isInteger(value) || value < 1 || value > 3650) {
    return "invalid" as const;
  }

  return value;
}

export async function updateTreatmentAction(
  patientId: string,
  treatmentId: string,
  values: TreatmentValues,
): Promise<ChartActionResult> {
  const parsed = treatmentSchema.safeParse(values);

  if (!parsed.success || !isUuid(patientId) || !isUuid(treatmentId)) {
    return {
      status: "error",
      message: parsed.success
        ? "The treatment could not be saved."
        : (parsed.error.issues[0]?.message ??
          "Check the treatment and try again."),
    };
  }

  const workspace = await requireStaffClinic();
  if (!workspace?.activeMembership) {
    return {
      status: "error",
      message: "Patient charts are limited to professionals in a clinic.",
    };
  }

  const supabase = await createClient();
  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id")
    .eq("id", patientId)
    .eq("organization_id", workspace.activeMembership.organizationId)
    .maybeSingle();

  if (patientError || !patient) {
    return { status: "error", message: "The treatment could not be saved." };
  }

  const { data, error } = await supabase
    .from("treatments")
    .update({
      name: parsed.data.name,
      category: parsed.data.category,
      procedure_type: parsed.data.procedureType ?? "",
      product_name: parsed.data.productName ?? "",
      protocol_code: parsed.data.protocolCode ?? "FACE_STANDARD",
      body_area: parsed.data.bodyArea,
      description: blankToNull(parsed.data.description),
      start_date: blankToNull(parsed.data.startDate),
      status: parsed.data.status,
    })
    .eq("id", treatmentId)
    .eq("patient_id", patientId)
    .select("id");

  if (error || !data?.length) {
    return { status: "error", message: "The treatment could not be saved." };
  }

  revalidatePath("/home");
  revalidatePath(`/patients/${patientId}`);
  revalidatePath(`/patients/${patientId}/treatments/${treatmentId}`);
  redirect(`/patients/${patientId}/treatments/${treatmentId}`);
}
