import "server-only";

import {
  dueRemindersInOrganization,
  type DueReminderView,
  type Reminder,
  type ReminderTreatmentOption,
} from "@/features/follow-ups/reminders";
import { followUpReminders, type FollowUpReminderRow } from "@/features/follow-ups/table";
import { isUuid } from "@/lib/ids";
import { createClient } from "@/lib/supabase/server";

export type ReminderQueryResult<T> =
  | { ok: true; items: T }
  | { ok: false; message: string };

type PatientEmbed = {
  first_name: string;
  last_name: string;
  organization_id: string;
};

export async function listReminderTreatments(
  organizationId: string,
): Promise<ReminderQueryResult<ReminderTreatmentOption[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("treatments")
    .select("id, name, patients!inner(first_name, last_name, organization_id)")
    .eq("patients.organization_id", organizationId)
    .order("name")
    .limit(200);

  if (error) {
    return { ok: false, message: "Treatments could not be loaded." };
  }

  const items = (data ?? []).flatMap((row) => {
    const patient = one(row.patients as PatientEmbed | PatientEmbed[] | null);
    if (!patient || patient.organization_id !== organizationId) {
      return [];
    }

    return [
      {
        id: row.id,
        label: `${patient.first_name} ${patient.last_name} · ${row.name}`,
      },
    ];
  });

  return { ok: true, items };
}

export async function listDueReminders(
  organizationId: string,
  today: string,
): Promise<ReminderQueryResult<DueReminderView[]>> {
  const supabase = await createClient();
  const { data, error } = await followUpReminders(supabase)
    .select(
      "id, organization_id, treatment_id, due_on, note, completed_at, created_by, created_at",
    )
    .eq("organization_id", organizationId)
    .is("completed_at", null)
    .order("due_on", { ascending: true });

  if (error || !data) {
    return { ok: false, message: "Reminders could not be loaded." };
  }

  const due = dueRemindersInOrganization(
    data.flatMap((row) => {
      const reminder = toReminder(row);
      return reminder ? [reminder] : [];
    }),
    today,
    organizationId,
  );

  if (due.length === 0) {
    return { ok: true, items: [] };
  }

  const treatmentIds = [...new Set(due.map((reminder) => reminder.treatmentId))];
  const { data: treatments, error: treatmentError } = await supabase
    .from("treatments")
    .select("id, name, patients!inner(first_name, last_name, organization_id)")
    .in("id", treatmentIds)
    .eq("patients.organization_id", organizationId);

  if (treatmentError) {
    return { ok: false, message: "Reminders could not be loaded." };
  }

  const labels = new Map<string, { patientName: string; treatmentName: string }>();
  for (const row of treatments ?? []) {
    const patient = one(row.patients as PatientEmbed | PatientEmbed[] | null);
    if (!patient || patient.organization_id !== organizationId) {
      continue;
    }

    labels.set(row.id, {
      patientName: `${patient.first_name} ${patient.last_name}`,
      treatmentName: row.name,
    });
  }

  return {
    ok: true,
    items: due.map((reminder) => {
      const label = labels.get(reminder.treatmentId);
      return {
        id: reminder.id,
        patientName: label?.patientName ?? "Chart unavailable",
        treatmentName: label?.treatmentName ?? "",
        dueOn: reminder.dueOn,
        note: reminder.note,
      };
    }),
  };
}

function toReminder(row: FollowUpReminderRow): Reminder | null {
  if (!isUuid(row.id) || !isUuid(row.organization_id) || !isUuid(row.treatment_id)) {
    return null;
  }

  return {
    id: row.id,
    organizationId: row.organization_id,
    treatmentId: row.treatment_id,
    dueOn: row.due_on,
    note: row.note,
    completedAt: row.completed_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}
