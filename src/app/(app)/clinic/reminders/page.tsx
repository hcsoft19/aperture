import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getWorkspace } from "@/features/access/workspace";
import { DueReminderList } from "@/features/follow-ups/due-list";
import { listDueReminders, listReminderTreatments } from "@/features/follow-ups/queries";
import { ScheduleReminderForm } from "@/features/follow-ups/schedule-form";
import { ChartMessage } from "@/features/patients/chart-message";

export const metadata: Metadata = {
  title: "Follow-up reminders",
  robots: { index: false, follow: false },
};

export default function FollowUpRemindersPage() {
  return (
    <Suspense
      fallback={
        <p className="text-base text-muted-foreground">Loading reminders…</p>
      }
    >
      <FollowUpRemindersContent />
    </Suspense>
  );
}

async function FollowUpRemindersContent() {
  const workspace = await getWorkspace();

  if (!workspace) {
    redirect("/login");
  }

  if (workspace.kind !== "staff" || !workspace.activeMembership) {
    return (
      <ChartMessage
        title="Follow-up reminders"
        message="Follow-up reminders are limited to clinic staff."
      />
    );
  }

  const organizationId = workspace.activeMembership.organizationId;
  const today = new Date().toISOString().slice(0, 10);
  const [treatments, reminders] = await Promise.all([
    listReminderTreatments(organizationId),
    listDueReminders(organizationId, today),
  ]);

  return (
    <section className="flex max-w-2xl flex-col gap-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Follow-up reminders</h1>
        <p className="mt-2 text-base leading-7 text-muted-foreground">
          {workspace.activeMembership.organizationName}
        </p>
      </header>
      <section aria-labelledby="schedule-reminder-heading" className="flex flex-col gap-4">
        <h2 id="schedule-reminder-heading" className="text-xl font-semibold">
          Schedule
        </h2>
        {treatments.ok && treatments.items.length > 0 ? (
          <ScheduleReminderForm treatments={treatments.items} today={today} />
        ) : (
          <p className="text-base leading-7 text-muted-foreground">
            {treatments.ok
              ? "Add a treatment before scheduling a reminder."
              : treatments.message}
          </p>
        )}
      </section>
      <section aria-labelledby="due-reminders-heading" className="flex flex-col gap-4">
        <h2 id="due-reminders-heading" className="text-xl font-semibold">
          Due
        </h2>
        {reminders.ok ? (
          <DueReminderList reminders={reminders.items} />
        ) : (
          <p className="text-base leading-7 text-destructive" role="alert">
            {reminders.message}
          </p>
        )}
      </section>
    </section>
  );
}
