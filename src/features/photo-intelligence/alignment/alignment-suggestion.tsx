"use client";

import { Button } from "@/components/ui/button";
import type { AlignmentSuggestionResult, AlignmentValues } from "@/features/photo-intelligence/alignment/suggest";

const unavailableCopy = {
  different_angle: "Alignment is only suggested for the same protocol angle.",
  missing_geometry: "An alignment suggestion is not available.",
} as const;

export function AlignmentSuggestion({
  suggestion,
  onAccept,
  onReject,
}: {
  suggestion: AlignmentSuggestionResult;
  onAccept: (values: AlignmentValues) => void;
  onReject: () => void;
}) {
  if (!suggestion.ok) {
    return (
      <p className="text-base leading-6" role="status">
        {unavailableCopy[suggestion.reason]}
      </p>
    );
  }

  const values: AlignmentValues = {
    x: suggestion.x,
    y: suggestion.y,
    rotation: suggestion.rotation,
    scale: suggestion.scale,
  };

  return (
    <section className="flex flex-col items-start gap-3 rounded-2xl bg-card p-5 ring-1 ring-foreground/10" aria-label="Suggested alignment">
      <p className="text-base leading-6">Suggested alignment. This does not change the original photograph.</p>
      <p className="text-base font-medium">{suggestion.confidence < 0.6 ? "Limited confidence" : "Usable suggestion"}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="lg" className="min-h-11" onClick={() => onAccept(values)}>
          Accept suggestion
        </Button>
        <Button type="button" size="lg" variant="outline" className="min-h-11" onClick={onReject}>
          Reject suggestion
        </Button>
      </div>
    </section>
  );
}
