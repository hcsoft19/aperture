"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  grantConsentAction,
  withdrawConsentAction,
} from "@/features/purpose-consent/actions";
import { CONSENT_PURPOSE_DETAILS } from "@/features/purpose-consent/purposes";
import type { ConsentSummary } from "@/features/purpose-consent/rules";
import type { ConsentActionResult } from "@/features/purpose-consent/schema";
import { formatChartDate } from "@/features/patients/labels";

export function ConsentPanel({
  patientId,
  summaries,
}: {
  patientId: string;
  summaries: ConsentSummary[];
}) {
  return (
    <ul aria-label="Consent purposes" className="flex flex-col gap-3">
      {summaries.map((summary) => (
        <li key={summary.purpose}>
          <PurposeDecision patientId={patientId} summary={summary} />
        </li>
      ))}
    </ul>
  );
}

function PurposeDecision({
  patientId,
  summary,
}: {
  patientId: string;
  summary: ConsentSummary;
}) {
  const action = summary.allowed ? withdrawConsentAction : grantConsentAction;
  const [state, formAction, pending] = useActionState<
    ConsentActionResult | null,
    FormData
  >(action, null);
  const label = summary.allowed
    ? `Withdraw ${summary.purpose}`
    : `Grant ${summary.purpose}`;

  return (
    <form
      action={formAction}
      className="flex flex-col items-start gap-3 rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10"
    >
      <div>
        <h2 className="text-base font-semibold">{summary.purpose}</h2>
        <p className="mt-1 text-base leading-6 text-muted-foreground">
          {CONSENT_PURPOSE_DETAILS[summary.purpose]}
        </p>
        <p className="mt-2 text-base">{statusText(summary)}</p>
      </div>
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="purpose" value={summary.purpose} />
      <Button
        type="submit"
        size="lg"
        variant={summary.allowed ? "outline" : "default"}
        disabled={pending}
        aria-busy={pending || undefined}
      >
        {label}
      </Button>
      {pending ? (
        <p className="text-base text-muted-foreground" role="status">
          Saving…
        </p>
      ) : null}
      {state?.status === "error" ? (
        <p className="text-base text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}
      {state?.status === "success" ? (
        <p className="text-base text-muted-foreground" role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function statusText(summary: ConsentSummary) {
  if (summary.allowed) {
    const granted = formatChartDate(summary.grantedAt);
    return granted ? `Granted ${granted}` : "Granted";
  }

  const withdrawn = formatChartDate(summary.revokedAt);
  return withdrawn ? `Withdrawn ${withdrawn}` : "Not granted";
}
