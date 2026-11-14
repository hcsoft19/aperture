import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export type FollowUpReminderRow = {
  id: string;
  organization_id: string;
  treatment_id: string;
  due_on: string;
  note: string | null;
  completed_at: string | null;
  created_by: string;
  created_at: string;
};

type ReminderWrite = {
  organization_id: string;
  treatment_id: string;
  due_on: string;
  note: string | null;
  created_by: string;
};

type ReminderResult<T> = {
  data: T;
  error: { message: string } | null;
};

type ReminderFilter = {
  eq: (column: "organization_id", value: string) => ReminderFilter;
  is: (column: "completed_at", value: null) => ReminderFilter;
  order: (
    column: "due_on",
    options: { ascending: boolean },
  ) => Promise<ReminderResult<FollowUpReminderRow[] | null>>;
};

type ReminderUpdate = {
  eq: (column: "id" | "organization_id", value: string) => ReminderUpdate;
  is: (column: "completed_at", value: null) => ReminderUpdate;
  select: (
    columns: "id",
  ) => Promise<ReminderResult<Array<{ id: string }> | null>>;
};

type ReminderTable = {
  select: (
    columns: "id, organization_id, treatment_id, due_on, note, completed_at, created_by, created_at",
  ) => ReminderFilter;
  insert: (row: ReminderWrite) => Promise<ReminderResult<null>>;
  update: (row: { completed_at: string }) => ReminderUpdate;
};

/**
 * Generated database types do not list follow_up_reminders yet.
 * Queries stay on the signed-in client so row security still applies.
 */
export function followUpReminders(supabase: SupabaseClient<Database>) {
  const from = supabase.from.bind(supabase) as unknown as (
    table: "follow_up_reminders",
  ) => ReminderTable;
  return from("follow_up_reminders");
}
