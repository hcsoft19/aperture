import { isUuid } from "@/lib/ids";

export const MAX_FOLLOW_UP_DAYS = 3650;
export const MAX_REMINDER_NOTE_LENGTH = 500;

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const COMPLETED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export type Reminder = {
  id: string;
  organizationId: string;
  treatmentId: string;
  dueOn: string;
  note: string | null;
  completedAt: string | null;
  createdBy: string;
  createdAt: string;
};

export type ScheduledReminder = {
  treatmentId: string;
  dueOn: string;
};

export type ReminderTreatmentOption = {
  id: string;
  label: string;
};

export type DueReminderView = {
  id: string;
  patientName: string;
  treatmentName: string;
  dueOn: string;
  note: string | null;
};

export function isCalendarDate(value: string) {
  return parseCalendarDate(value) !== null;
}

export function scheduleReminder(input: {
  treatmentId: string;
  fromDate: string;
  followUpDays: number;
}): ScheduledReminder {
  if (!isUuid(input.treatmentId)) {
    throw new Error("Choose a treatment.");
  }

  if (!isCalendarDate(input.fromDate)) {
    throw new Error("Enter a valid date.");
  }

  if (!isFollowUpDayCount(input.followUpDays)) {
    throw new Error("Enter a whole number of days from 0 to 3650.");
  }

  return {
    treatmentId: input.treatmentId,
    dueOn: addUtcDays(input.fromDate, input.followUpDays),
  };
}

export function dueReminders(reminders: readonly Reminder[], today: string) {
  if (!isCalendarDate(today)) {
    return [];
  }

  return reminders
    .filter(
      (reminder) =>
        reminder.completedAt === null &&
        isCalendarDate(reminder.dueOn) &&
        reminder.dueOn <= today,
    )
    .sort(
      (left, right) =>
        left.dueOn.localeCompare(right.dueOn) || left.id.localeCompare(right.id),
    );
}

export function dueRemindersInOrganization(
  reminders: readonly Reminder[],
  today: string,
  organizationId: string,
) {
  if (!isUuid(organizationId)) {
    return [];
  }

  return dueReminders(
    reminders.filter((reminder) => reminder.organizationId === organizationId),
    today,
  );
}

export function completeReminder(reminder: Reminder, completedAt: string): Reminder {
  if (reminder.completedAt !== null) {
    return reminder;
  }

  if (!COMPLETED_AT.test(completedAt)) {
    throw new Error("Enter a valid completion time.");
  }

  return { ...reminder, completedAt };
}

function isFollowUpDayCount(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_FOLLOW_UP_DAYS;
}

function parseCalendarDate(value: string) {
  const match = CALENDAR_DATE.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function addUtcDays(isoDate: string, days: number) {
  const date = parseCalendarDate(isoDate);
  if (!date) {
    throw new Error("Enter a valid date.");
  }

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
