"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getWorkspace } from "@/features/access/workspace";
import { formatChartDate } from "@/features/patients/labels";
import { scheduleReminder } from "@/features/follow-ups/reminders";
import {
  completeReminderSchema,
  scheduleReminderSchema,
  type CompleteReminderValues,
  type ScheduleReminderValues,
} from "@/features/follow-ups/schema";
import { followUpReminders } from "@/features/follow-ups/table";
import { createClient } from "@/lib/supabase/server";

export type ReminderActionResult =
  | { status: "error"; message: string }
  | { status: "success"; message: string };

const REMINDERS_PATH = "/clinic/reminders";

export async function scheduleFollowUpReminderAction(
  values: ScheduleReminderValues,
): Promise<ReminderActionResult> {
  const parsed = scheduleReminderSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the reminder and try again.",
    };
  }

  const workspace = await requireStaffClinic();
  if (!workspace?.activeMembership) {
    return {
      status: "error",
      message: "Follow-up reminders are limited to clinic staff.",
    };
  }

  let scheduled: ReturnType<typeof scheduleReminder>;
  try {
    scheduled = scheduleReminder(parsed.data);
  } catch {
    return { status: "error", message: "Check the reminder and try again." };
  }

  const supabase = await createClient();
  const organizationId = workspace.activeMembership.organizationId;
  const { data: treatment, error: treatmentError } = await supabase
    .from("treatments")
    .select("id, patients!inner(organization_id)")
    .eq("id", scheduled.treatmentId)
    .eq("patients.organization_id", organizationId)
    .maybeSingle();

  if (treatmentError || !treatment) {
    return { status: "error", message: "That treatment is not available." };
  }

  const { error } = await followUpReminders(supabase).insert({
    organization_id: organizationId,
    treatment_id: scheduled.treatmentId,
    due_on: scheduled.dueOn,
    note: parsed.data.note.length > 0 ? parsed.data.note : null,
    created_by: workspace.user.id,
  });

  if (error) {
    return { status: "error", message: "The reminder could not be saved." };
  }

  revalidatePath(REMINDERS_PATH);
  const dueLabel = formatChartDate(scheduled.dueOn) ?? scheduled.dueOn;
  return {
    status: "success",
    message: `Follow-up reminder scheduled for ${dueLabel}.`,
  };
}

export async function completeFollowUpReminderAction(
  values: CompleteReminderValues,
): Promise<ReminderActionResult> {
  const parsed = completeReminderSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "That reminder could not be completed.",
    };
  }

  const workspace = await requireStaffClinic();
  if (!workspace?.activeMembership) {
    return {
      status: "error",
      message: "Follow-up reminders are limited to clinic staff.",
    };
  }

  const supabase = await createClient();
  const completedAt = new Date().toISOString();
  const { data, error } = await followUpReminders(supabase)
    .update({ completed_at: completedAt })
    .eq("id", parsed.data.reminderId)
    .eq("organization_id", workspace.activeMembership.organizationId)
    .is("completed_at", null)
    .select("id");

  if (error || !data?.length) {
    return { status: "error", message: "That reminder could not be completed." };
  }

  revalidatePath(REMINDERS_PATH);
  return { status: "success", message: "Reminder completed." };
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
