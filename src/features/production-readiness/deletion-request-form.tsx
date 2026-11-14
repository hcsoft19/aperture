"use client";

import { useActionState } from "react";

import { recordDeletionRequestAction } from "@/features/production-readiness/actions";

export function DeletionRequestForm({ patientId }: { patientId: string }) {
  const [state, action, pending] = useActionState(recordDeletionRequestAction, null);

  return (
    <form action={action} className="flex max-w-xl flex-col gap-3">
      <input type="hidden" name="patientId" value={patientId} />
      <p className="text-base">
        Recording a request does not delete photographs. This prototype cannot purge backups.
      </p>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center self-start rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Recording…" : "Record a deletion request"}
      </button>
      {state ? (
        <p className="text-base" role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
