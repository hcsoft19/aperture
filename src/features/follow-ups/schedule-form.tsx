"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { scheduleFollowUpReminderAction } from "@/features/follow-ups/actions";
import type { ReminderTreatmentOption } from "@/features/follow-ups/reminders";
import {
  scheduleReminderSchema,
  type ScheduleReminderValues,
} from "@/features/follow-ups/schema";

type ScheduleReminderFormProps = {
  treatments: ReminderTreatmentOption[];
  today: string;
};

export function ScheduleReminderForm({ treatments, today }: ScheduleReminderFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<"error" | "success" | null>(null);
  const form = useForm<ScheduleReminderValues>({
    resolver: zodResolver(scheduleReminderSchema),
    defaultValues: {
      treatmentId: "",
      fromDate: today,
      followUpDays: 14,
      note: "",
    },
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(async (values) => {
    setMessage(null);
    setStatus(null);
    const result = await scheduleFollowUpReminderAction(values);
    setStatus(result.status);
    setMessage(result.message);
  });

  return (
    <form className="flex max-w-md flex-col gap-4" onSubmit={onSubmit} noValidate>
      {message ? (
        <p
          className={
            status === "success"
              ? "text-base text-foreground"
              : "text-base text-destructive"
          }
          role={status === "success" ? "status" : "alert"}
        >
          {message}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="reminder-treatment" className="text-base">
          Treatment
        </Label>
        <select
          id="reminder-treatment"
          className="min-h-11 rounded-lg border border-input bg-transparent px-3 text-base"
          aria-invalid={errors.treatmentId ? true : undefined}
          aria-describedby={errors.treatmentId ? "reminder-treatment-error" : undefined}
          {...form.register("treatmentId")}
        >
          <option value="">Select a treatment</option>
          {treatments.map((treatment) => (
            <option key={treatment.id} value={treatment.id}>
              {treatment.label}
            </option>
          ))}
        </select>
        {errors.treatmentId?.message ? (
          <p id="reminder-treatment-error" className="text-base text-destructive" role="alert">
            {errors.treatmentId.message}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="reminder-from-date" className="text-base">
          Starting date
        </Label>
        <Input
          id="reminder-from-date"
          type="date"
          aria-invalid={errors.fromDate ? true : undefined}
          aria-describedby={errors.fromDate ? "reminder-from-date-error" : undefined}
          {...form.register("fromDate")}
        />
        {errors.fromDate?.message ? (
          <p id="reminder-from-date-error" className="text-base text-destructive" role="alert">
            {errors.fromDate.message}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="reminder-follow-up-days" className="text-base">
          Follow up after (days)
        </Label>
        <Input
          id="reminder-follow-up-days"
          type="number"
          inputMode="numeric"
          min={0}
          max={3650}
          step={1}
          aria-invalid={errors.followUpDays ? true : undefined}
          aria-describedby={
            errors.followUpDays
              ? "reminder-follow-up-days-hint reminder-follow-up-days-error"
              : "reminder-follow-up-days-hint"
          }
          {...form.register("followUpDays", { valueAsNumber: true })}
        />
        <p id="reminder-follow-up-days-hint" className="text-base text-muted-foreground">
          The reminder is due this many days after the starting date.
        </p>
        {errors.followUpDays?.message ? (
          <p id="reminder-follow-up-days-error" className="text-base text-destructive" role="alert">
            {errors.followUpDays.message}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="reminder-note" className="text-base">
          Note (optional)
        </Label>
        <Textarea
          id="reminder-note"
          rows={3}
          aria-invalid={errors.note ? true : undefined}
          aria-describedby={errors.note ? "reminder-note-error" : undefined}
          {...form.register("note")}
        />
        {errors.note?.message ? (
          <p id="reminder-note-error" className="text-base text-destructive" role="alert">
            {errors.note.message}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Scheduling…" : "Schedule reminder"}
      </Button>
    </form>
  );
}
