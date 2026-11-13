"use client";

import { useState } from "react";
import Image from "next/image";

import type { ReleasedComparison } from "@/features/portal/queries";

export function ReleasedComparisonView({ comparison }: { comparison: ReleasedComparison }) {
  const [position, setPosition] = useState(50);
  if (!comparison.beforeUrl || !comparison.afterUrl) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <h3 className="text-lg font-semibold">{comparison.angleName}</h3>
      <p className="text-sm font-medium">{comparison.aligned ? "Aligned" : "Not aligned"}</p>
      <div className="grid grid-cols-2 gap-2">
        <figure>
          <Image src={comparison.beforeUrl} alt={`Baseline ${comparison.angleName}`} width={600} height={800} unoptimized className="aspect-[3/4] w-full rounded-lg bg-muted object-contain" />
          <figcaption className="mt-2 text-sm">Baseline</figcaption>
        </figure>
        <figure>
          <Image src={comparison.afterUrl} alt={`Follow-up ${comparison.angleName}`} width={600} height={800} unoptimized className="aspect-[3/4] w-full rounded-lg bg-muted object-contain" style={{ transform: `translate(${comparison.x}%, ${comparison.y}%) rotate(${comparison.rotation}deg) scale(${comparison.scale})` }} />
          <figcaption className="mt-2 text-sm">Follow-up</figcaption>
        </figure>
      </div>
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-muted">
        <Image src={comparison.beforeUrl} alt="" fill unoptimized sizes="(min-width: 768px) 672px, 100vw" className="object-contain" />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
          <Image src={comparison.afterUrl} alt="" fill unoptimized sizes="(min-width: 768px) 672px, 100vw" className="object-contain" style={{ transform: `translate(${comparison.x}%, ${comparison.y}%) rotate(${comparison.rotation}deg) scale(${comparison.scale})` }} />
        </div>
      </div>
      <label htmlFor={`split-${comparison.id}`} className="font-medium">Comparison split</label>
      <input id={`split-${comparison.id}`} type="range" min="0" max="100" value={position} onChange={(event) => setPosition(Number(event.target.value))} className="min-h-11 w-full accent-primary" />
    </section>
  );
}
