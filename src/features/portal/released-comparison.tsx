"use client";

import { useState } from "react";
import Image from "next/image";

import type { ReleasedComparison } from "@/features/portal/queries";

export function ReleasedComparisonView({ comparison }: { comparison: ReleasedComparison }) {
  const [position, setPosition] = useState(50);
  if (!comparison.beforeUrl || !comparison.afterUrl) {
    return null;
  }

  const afterTransform = `translate(${comparison.x}%, ${comparison.y}%) rotate(${comparison.rotation}deg) scale(${comparison.scale * comparison.afterZoom})`;

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <h3 className="text-lg font-semibold">{comparison.angleName}</h3>
      <p className="text-sm font-medium">{comparison.aligned ? "Aligned" : "Not aligned"}</p>
      {comparison.layout !== "slider" ? (
        <div className={comparison.layout === "stack" ? "grid gap-2" : "grid grid-cols-2 gap-2"}>
          <figure>
            <Image src={comparison.beforeUrl} alt={`Baseline ${comparison.angleName}`} width={600} height={800} unoptimized className="aspect-[3/4] w-full rounded-lg bg-muted object-contain" style={{ transform: `scale(${comparison.beforeZoom})` }} />
            <figcaption className="mt-2 text-sm">Baseline</figcaption>
          </figure>
          <figure>
            <Image src={comparison.afterUrl} alt={`Follow-up ${comparison.angleName}`} width={600} height={800} unoptimized className="aspect-[3/4] w-full rounded-lg bg-muted object-contain" style={{ transform: afterTransform }} />
            <figcaption className="mt-2 text-sm">Follow-up</figcaption>
          </figure>
        </div>
      ) : (
        <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-muted">
          <Image src={comparison.beforeUrl} alt="" fill unoptimized sizes="(min-width: 768px) 672px, 100vw" className="object-contain" />
          <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
            <Image src={comparison.afterUrl} alt="" fill unoptimized sizes="(min-width: 768px) 672px, 100vw" className="object-contain" style={{ transform: afterTransform }} />
          </div>
          <label htmlFor={`split-${comparison.id}`} className="sr-only">Comparison split</label>
          <input id={`split-${comparison.id}`} type="range" min="0" max="100" value={position} onChange={(event) => setPosition(Number(event.target.value))} className="absolute inset-x-3 bottom-3 min-h-11 w-[calc(100%-1.5rem)]" />
        </div>
      )}
    </section>
  );
}
