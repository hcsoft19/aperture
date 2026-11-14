"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { completeFollowUpReminderAction } from "@/features/follow-ups/actions";

type CompleteReminderButtonProps = {
  reminderId: string;
  label: string;
};

export function CompleteReminderButton({ reminderId, label }: CompleteReminderButtonProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setPending(true);
    const result = await completeFollowUpReminderAction({ reminderId });
    setPending(false);
    if (result.status === "error") {
      setMessage(result.message);
      return;
    }
    setCompleted(true);
  }

  if (completed) {
    return (
      <p className="text-base" role="status">
        Reminder completed.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      {message ? (
        <p className="text-base text-destructive" role="alert">
          {message}
        </p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        variant="outline"
        disabled={pending}
        aria-label={`Mark complete, ${label}`}
      >
        {pending ? "Saving…" : "Mark complete"}
      </Button>
    </form>
  );
}
