import { CompleteReminderButton } from "@/features/follow-ups/complete-button";
import type { DueReminderView } from "@/features/follow-ups/reminders";
import { formatChartDate } from "@/features/patients/labels";

export function DueReminderList({ reminders }: { reminders: DueReminderView[] }) {
  if (reminders.length === 0) {
    return (
      <p className="text-base leading-7 text-muted-foreground">
        No follow-up reminders are due.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {reminders.map((reminder) => {
        const dueLabel = formatChartDate(reminder.dueOn) ?? reminder.dueOn;
        const title = reminder.treatmentName
          ? `${reminder.patientName} · ${reminder.treatmentName}`
          : reminder.patientName;
        return (
          <li
            key={reminder.id}
            className="flex flex-col gap-4 rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-base font-medium">{title}</p>
              <p className="text-base text-muted-foreground">Due {dueLabel}</p>
              {reminder.note ? <p className="mt-1 text-base">{reminder.note}</p> : null}
            </div>
            <CompleteReminderButton
              reminderId={reminder.id}
              label={`${title}, due ${dueLabel}`}
            />
          </li>
        );
      })}
    </ul>
  );
}
