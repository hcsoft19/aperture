"use client";

import { useState } from "react";

import { RecommendationList } from "@/features/photo-intelligence/recommendations/recommendation-list";
import type { RecommendationResult } from "@/features/photo-intelligence/recommendations/recommend";

export function SetupSuggestions({
  status,
  warnings,
}: {
  status: "good" | "warning" | "poor" | "unavailable";
  warnings: string[];
}) {
  const [recommendation, setRecommendation] = useState<RecommendationResult | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="min-h-11 self-start rounded-md border px-3 text-base"
        disabled={pending}
        onClick={() => {
          setPending(true);
          void import("@/features/photo-intelligence/actions")
            .then((module) => module.setupSuggestionsAction({ status, warnings }))
            .then(setRecommendation)
            .finally(() => setPending(false));
        }}
      >
        {pending ? "Preparing suggestions…" : "Show setup suggestions"}
      </button>
      {recommendation ? <RecommendationList recommendation={recommendation} /> : null}
    </div>
  );
}
