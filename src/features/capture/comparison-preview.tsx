"use client";

import { useState } from "react";
import Image from "next/image";
import type { CaptureSessionView } from "@/features/capture/queries";

export function ComparisonPreview({ session }: { session: CaptureSessionView }) {
  const angles = session.protocol.angles.filter((angle) =>
    session.photos.some((photo) => photo.angleId === angle.id && photo.previewUrl) &&
    session.references.some((photo) => photo.angleId === angle.id && photo.previewUrl),
  );
  const [angleId, setAngleId] = useState(angles[0]?.id ?? "");
  const [position, setPosition] = useState(50);
  const before = session.references.find((photo) => photo.angleId === angleId)?.previewUrl;
  const after = session.photos.find((photo) => photo.angleId === angleId)?.previewUrl;

  if (!angles.length || !before || !after) return null;

  return (
    <section className="mt-6 max-w-2xl rounded-2xl bg-card p-5 ring-1 ring-foreground/10" aria-labelledby="comparison-heading">
      <h2 id="comparison-heading" className="text-xl font-semibold">Compare photographs</h2>
      <p className="mt-2 text-base text-muted-foreground">Review the baseline and this follow-up. The original photographs are unchanged.</p>
      <label htmlFor="comparison-angle" className="mt-4 block font-medium">Facial angle</label>
      <select id="comparison-angle" value={angleId} onChange={(event) => setAngleId(event.target.value)} className="mt-2 min-h-11 w-full rounded-md border bg-background px-3">
        {angles.map((angle) => <option key={angle.id} value={angle.id}>{angle.name}</option>)}
      </select>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {[{ url: before, label: "Baseline" }, { url: after, label: "Follow-up" }].map((photo) => (
          <figure key={photo.label}>
            <Image src={photo.url} alt={`${photo.label} photograph`} width={600} height={800} unoptimized className="aspect-[3/4] w-full rounded-lg object-contain bg-muted" />
            <figcaption className="mt-2 text-sm font-medium">{photo.label}</figcaption>
          </figure>
        ))}
      </div>
      <div className="relative mt-5 aspect-[3/4] overflow-hidden rounded-lg bg-muted">
        <Image src={before} alt="" fill unoptimized sizes="(min-width: 768px) 672px, 100vw" className="object-contain" />
        <Image src={after} alt="" fill unoptimized sizes="(min-width: 768px) 672px, 100vw" className="object-contain" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }} />
      </div>
      <label htmlFor="comparison-position" className="mt-4 block font-medium">Comparison: follow-up on the left, baseline on the right</label>
      <input id="comparison-position" type="range" min="0" max="100" value={position} onChange={(event) => setPosition(Number(event.target.value))} className="mt-2 min-h-11 w-full accent-primary" />
      <p className="text-sm text-muted-foreground">Use the slider or arrow keys to change the split.</p>
    </section>
  );
}
