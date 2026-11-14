"use client";

import { useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { startCaptureAction } from "@/features/capture/actions";
import type { CaptureTarget } from "@/features/capture/queries";

type CaptureSetupProps = {
  targets: CaptureTarget[];
  initialTreatmentId?: string;
};

export function CaptureSetup({
  targets,
  initialTreatmentId,
}: CaptureSetupProps) {
  const initial = targets.some(
    (target) => target.treatmentId === initialTreatmentId,
  )
    ? initialTreatmentId
    : (targets[0]?.treatmentId ?? "");
  const [treatmentId, setTreatmentId] = useState(initial ?? "");
  const [sessionType, setSessionType] = useState<"baseline" | "follow_up">(
    targets.find((target) => target.treatmentId === initial)?.hasBaseline
      ? "follow_up"
      : "baseline",
  );
  const [confirmConsent, setConfirmConsent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const selected = useMemo(
    () => targets.find((target) => target.treatmentId === treatmentId) ?? null,
    [targets, treatmentId],
  );

  if (targets.length === 0) {
    return (
      <p className="text-base leading-7 text-muted-foreground">
        Add a treatment on a chart before starting a photography session.
      </p>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const result = await startCaptureAction({
      treatmentId,
      sessionType,
      confirmConsent,
    });
    if (result?.status === "error") {
      setMessage(result.message);
      setPending(false);
    }
  }

  return (
    <form className="flex max-w-xl flex-col gap-4" onSubmit={onSubmit}>
      {message ? (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="capture-treatment">Treatment</Label>
        <select
          id="capture-treatment"
          className="h-11 rounded-lg border border-input bg-transparent px-3 text-base"
          value={treatmentId}
          onChange={(event) => {
            setTreatmentId(event.target.value);
            setSessionType(
              targets.find(
                (target) => target.treatmentId === event.target.value,
              )?.hasBaseline
                ? "follow_up"
                : "baseline",
            );
            setConfirmConsent(false);
          }}
        >
          {targets.map((target) => (
            <option key={target.treatmentId} value={target.treatmentId}>
              {target.patientName} — {target.treatmentName}
            </option>
          ))}
        </select>
      </div>
      <p className="text-base text-muted-foreground">
        Selected protocol:{" "}
        {(selected?.protocolCode ?? "FACE_STANDARD")
          .replaceAll("_", " ")
          .toLowerCase()}
      </p>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Session</legend>
        <label className="flex min-h-11 items-center gap-3 text-base">
          <input
            type="radio"
            name="session-type"
            checked={sessionType === "baseline"}
            onChange={() => setSessionType("baseline")}
          />
          Baseline
        </label>
        <label className="flex min-h-11 items-center gap-3 text-base">
          <input
            type="radio"
            name="session-type"
            checked={sessionType === "follow_up"}
            disabled={!selected?.hasBaseline}
            onChange={() => setSessionType("follow_up")}
          />
          Follow-up
        </label>
        {selected && !selected.hasBaseline ? (
          <p className="text-sm text-muted-foreground">
            A follow-up waits until this treatment has a finished baseline.
          </p>
        ) : null}
      </fieldset>
      {selected && !selected.hasConsent ? (
        <label className="flex min-h-11 items-start gap-3 text-base">
          <input
            type="checkbox"
            className="mt-1"
            checked={confirmConsent}
            onChange={(event) => setConfirmConsent(event.target.checked)}
          />
          <span>
            The patient agrees to clinical photographs for this treatment.
          </span>
        </label>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Starting…" : "Start session"}
      </Button>
    </form>
  );
}
