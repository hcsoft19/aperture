"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  releaseProgressAction,
  revokeProgressAction,
} from "@/features/progress-gallery/actions";
import {
  EMPTY_PROGRESS_MESSAGE,
  type ProgressActionResult,
  type ProgressGalleryEntry,
} from "@/features/progress-gallery/model";
import { formatChartDate } from "@/features/patients/labels";

export function ProgressGallery({
  patientId,
  items,
  releasesUnavailable,
}: {
  patientId: string;
  items: ProgressGalleryEntry[];
  releasesUnavailable: boolean;
}) {
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-4">
      {releasesUnavailable ? (
        <p className="text-base leading-7 text-muted-foreground" role="status">
          Saved releases could not be loaded. Try again before releasing anything new.
        </p>
      ) : null}
      {items.length === 0 ? (
        <div>
          <h2 className="text-lg font-semibold">Nothing to release</h2>
          <p className="mt-2 text-base leading-7 text-muted-foreground">{EMPTY_PROGRESS_MESSAGE}</p>
        </div>
      ) : (
        <ul className="flex min-w-0 max-w-full flex-col gap-3">
          {items.map((item) => (
            <li key={`${item.kind}:${item.id}`} className="min-w-0 max-w-full">
              <ReleaseControl
                patientId={patientId}
                item={item}
                releasesUnavailable={releasesUnavailable}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ReleaseControl({
  patientId,
  item,
  releasesUnavailable,
}: {
  patientId: string;
  item: ProgressGalleryEntry;
  releasesUnavailable: boolean;
}) {
  const released = item.releaseId !== null;
  const action = released ? revokeProgressAction : releaseProgressAction;
  const [state, formAction, pending] = useActionState<ProgressActionResult | null, FormData>(
    action,
    null,
  );
  const label = released ? `Revoke ${item.label}` : `Release ${item.label}`;
  const dateLabel = formatChartDate(item.createdAt);
  const status = releasesUnavailable
    ? "Release status unavailable"
    : released
      ? "Released to the patient"
      : "Not released";

  return (
    <form
      action={formAction}
      className="flex min-w-0 max-w-full flex-col items-start gap-3 rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10"
    >
      <div>
        <h2 className="text-base font-semibold">{item.label}</h2>
        <p className="mt-1 text-base leading-6 text-muted-foreground">
          {dateLabel ? `${dateLabel} · ${status}` : status}
        </p>
      </div>
      <input type="hidden" name="patientId" value={patientId} />
      {item.kind === "comparison" ? (
        <input type="hidden" name="comparisonId" value={item.id} />
      ) : (
        <input type="hidden" name="derivativeId" value={item.id} />
      )}
      {item.releaseId ? <input type="hidden" name="releaseId" value={item.releaseId} /> : null}
      <Button
        type="submit"
        size="lg"
        variant={released ? "outline" : "default"}
        disabled={pending || releasesUnavailable}
        aria-busy={pending || undefined}
        className="whitespace-normal h-auto min-h-11 max-w-full w-full text-left shrink"
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
