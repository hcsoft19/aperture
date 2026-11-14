import { z } from "zod";

import {
  isCalendarDate,
  MAX_FOLLOW_UP_DAYS,
  MAX_REMINDER_NOTE_LENGTH,
} from "@/features/follow-ups/reminders";
import { isUuid } from "@/lib/ids";

export const scheduleReminderSchema = z.object({
  treatmentId: z
    .string()
    .trim()
    .refine((value) => isUuid(value), "Choose a treatment."),
  fromDate: z
    .string()
    .trim()
    .refine((value) => isCalendarDate(value), "Enter a valid date."),
  followUpDays: z
    .number("Enter the number of days until the follow-up.")
    .int("Enter a whole number of days.")
    .min(0, "Follow-up days cannot be negative.")
    .max(MAX_FOLLOW_UP_DAYS, "Use 3650 days or fewer."),
  note: z
    .string()
    .trim()
    .max(MAX_REMINDER_NOTE_LENGTH, "Use 500 characters or fewer."),
});

export const completeReminderSchema = z.object({
  reminderId: z
    .string()
    .trim()
    .refine((value) => isUuid(value), "Choose a reminder."),
});

export type ScheduleReminderValues = z.infer<typeof scheduleReminderSchema>;
export type CompleteReminderValues = z.infer<typeof completeReminderSchema>;
