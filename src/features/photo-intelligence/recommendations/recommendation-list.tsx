"use client";

import { useId } from "react";

import type { RecommendationResult } from "@/features/photo-intelligence/recommendations/recommend";

export function RecommendationList({ recommendation }: { recommendation: RecommendationResult }) {
  const headingId = useId();

  return (
    <section className="flex flex-col gap-2" aria-labelledby={headingId}>
      <h2 id={headingId} className="text-base">
        Setup suggestions
      </h2>
      {recommendation.available ? (
        <ul className="list-disc pl-5 text-base leading-6">
          {recommendation.items.map((item) => (
            <li key={item.code}>{item.text}</li>
          ))}
        </ul>
      ) : (
        <p className="text-base leading-6">Guidance is unavailable for this photograph.</p>
      )}
    </section>
  );
}
