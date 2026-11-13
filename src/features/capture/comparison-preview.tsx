"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { CaptureSessionView } from "@/features/capture/queries";
import { saveComparisonAction } from "@/features/capture/comparison-actions";

export function ComparisonPreview({ session }: { session: CaptureSessionView }) {
  const router = useRouter();
  const angles = session.protocol.angles.filter((angle) =>
    session.photos.some((photo) => photo.angleId === angle.id && photo.previewUrl) &&
    session.references.some((photo) => photo.angleId === angle.id && photo.previewUrl),
  );
  const [angleId, setAngleId] = useState(angles[0]?.id ?? "");
  const [position, setPosition] = useState(50);
  function savedAlignment(id: string) {
    const beforeId = session.references.find((photo) => photo.angleId === id)?.id;
    const afterId = session.photos.find((photo) => photo.angleId === id)?.id;
    const saved = session.comparisons.find((item) => item.beforeId === beforeId && item.afterId === afterId);
    return saved ? { x: saved.x, y: saved.y, rotation: saved.rotation, scale: saved.scale } : { x: 0, y: 0, rotation: 0, scale: 1 };
  }
  const [alignment, setAlignment] = useState(() => savedAlignment(angles[0]?.id ?? ""));
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const before = session.references.find((photo) => photo.angleId === angleId)?.previewUrl;
  const after = session.photos.find((photo) => photo.angleId === angleId)?.previewUrl;

  if (!angles.length || !before || !after) return null;

  return (
    <section className="mt-6 max-w-2xl rounded-2xl bg-card p-5 ring-1 ring-foreground/10" aria-labelledby="comparison-heading">
      <h2 id="comparison-heading" className="text-xl font-semibold">Compare photographs</h2>
      <p className="mt-2 text-base text-muted-foreground">Review the baseline and this follow-up. The original photographs are unchanged.</p>
      <label htmlFor="comparison-angle" className="mt-4 block font-medium">Facial angle</label>
      <select id="comparison-angle" value={angleId} onChange={(event) => { setAngleId(event.target.value); setAlignment(savedAlignment(event.target.value)); setMessage(""); }} className="mt-2 min-h-11 w-full rounded-md border bg-background px-3">
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
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
          <Image src={after} alt="" fill unoptimized sizes="(min-width: 768px) 672px, 100vw" className="object-contain" style={{ transform: `translate(${alignment.x}%, ${alignment.y}%) rotate(${alignment.rotation}deg) scale(${alignment.scale})` }} />
        </div>
      </div>
      <label htmlFor="comparison-position" className="mt-4 block font-medium">Comparison: follow-up on the left, baseline on the right</label>
      <input id="comparison-position" type="range" min="0" max="100" value={position} onChange={(event) => setPosition(Number(event.target.value))} className="mt-2 min-h-11 w-full accent-primary" />
      <p className="text-sm text-muted-foreground">Use the slider or arrow keys to change the split.</p>
      <fieldset className="mt-5 grid gap-3 sm:grid-cols-2">
        <legend className="font-medium">Align follow-up</legend>
        {([
          ["x", "Horizontal", -50, 50, 1],
          ["y", "Vertical", -50, 50, 1],
          ["rotation", "Rotation", -30, 30, 1],
          ["scale", "Scale", 0.5, 2, 0.01],
        ] as const).map(([key, label, min, max, step]) => (
          <label key={key} className="text-sm font-medium">{label}: {alignment[key]}
            <input type="range" min={min} max={max} step={step} value={alignment[key]} onChange={(event) => setAlignment({ ...alignment, [key]: Number(event.target.value) })} className="min-h-11 w-full accent-primary" />
          </label>
        ))}
      </fieldset>
      <p className="text-sm text-muted-foreground">{alignment.x || alignment.y || alignment.rotation || alignment.scale !== 1 ? "Alignment adjusted" : "Original alignment"}</p>
      <button type="button" disabled={saving} className="mt-4 min-h-11 rounded-md bg-primary px-5 font-medium text-primary-foreground disabled:opacity-50" onClick={async () => {
        const beforePhoto = session.references.find((photo) => photo.angleId === angleId);
        const afterPhoto = session.photos.find((photo) => photo.angleId === angleId);
        if (!beforePhoto || !afterPhoto) return;
        setSaving(true);
        try {
          const result = await saveComparisonAction({ beforeId: beforePhoto.id, afterId: afterPhoto.id, ...alignment });
          setMessage(result.message);
          if (result.ok) router.refresh();
        } catch {
          setMessage("The comparison could not be saved.");
        } finally {
          setSaving(false);
        }
      }}>Save comparison</button>
      <p role="status" className="mt-2 text-sm">{message}</p>
    </section>
  );
}
