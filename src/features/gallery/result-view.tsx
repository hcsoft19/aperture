"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Columns2, Layers2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { galleryDate, type GalleryResult } from "./models";

export function ResultView({ result }: { result: GalleryResult }) {
  const [mode, setMode] = useState<"pair" | "slider">("pair");
  const [split, setSplit] = useState(50);
  const treatmentUrl = `/patients/${result.patientId}/treatments/${result.treatmentId}`;
  const transform = `translate(${result.alignment.x}%, ${result.alignment.y}%) rotate(${result.alignment.rotation}deg) scale(${result.alignment.scale})`;
  return (
    <div className="grid gap-7 lg:grid-cols-[1.5fr_1fr]">
      <div>
        {!result.isPlate && (
          <div
            className="mb-4 flex flex-wrap gap-2"
            role="group"
            aria-label="Comparison view"
          >
            <button
              type="button"
              aria-pressed={mode === "pair"}
              onClick={() => setMode("pair")}
              className={buttonVariants({
                variant: mode === "pair" ? "secondary" : "ghost",
                size: "lg",
              })}
            >
              <Columns2 aria-hidden="true" />
              Side by side
            </button>
            <button
              type="button"
              aria-pressed={mode === "slider"}
              onClick={() => setMode("slider")}
              className={buttonVariants({
                variant: mode === "slider" ? "secondary" : "ghost",
                size: "lg",
              })}
            >
              <Layers2 aria-hidden="true" />
              Compare slider
            </button>
          </div>
        )}
        {result.isPlate && result.before.url ? (
          <figure>
            <Image
              src={result.before.url}
              alt={result.treatmentName}
              width={result.before.width ?? 800}
              height={result.before.height ?? 800}
              unoptimized
              className="h-auto max-h-[75vh] w-full rounded-xl bg-muted object-contain"
            />
            <figcaption className="mt-3 text-sm text-muted-foreground">
              Published comparison plate, preserved as supplied by its creator.
            </figcaption>
          </figure>
        ) : !result.before.url || !result.after.url ? (
          <div
            role="status"
            className="rounded-xl bg-muted p-6 text-base leading-7"
          >
            The photographs could not be loaded. Close and reopen this result to
            try again.
          </div>
        ) : mode === "pair" ? (
          <div className="grid grid-cols-2 gap-3">
            {[
              { ...result.before, label: "Before" },
              { ...result.after, label: "After" },
            ].map((photo) => (
              <figure key={photo.label}>
                <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted">
                  <Image
                    src={photo.url!}
                    alt={`${photo.label}: ${result.angleName}`}
                    fill
                    unoptimized
                    sizes="(min-width: 1024px) 300px, 45vw"
                    className="object-contain"
                  />
                </div>
                <figcaption className="mt-3 text-base font-medium">
                  {photo.label}
                  <span className="mt-1 block text-sm font-normal text-muted-foreground">
                    {galleryDate(photo.date)}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div>
            <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted">
              <Image
                src={result.before.url}
                alt={`Before: ${result.angleName}`}
                fill
                unoptimized
                sizes="600px"
                className="object-contain"
              />
              <div
                className="absolute inset-0"
                style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
              >
                <Image
                  src={result.after.url}
                  alt={`After: ${result.angleName}`}
                  fill
                  unoptimized
                  sizes="600px"
                  className="object-contain"
                  style={{ transform }}
                />
              </div>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow"
                style={{ left: `${split}%` }}
              />
              <span className="absolute top-3 left-3 rounded bg-card/95 px-2 py-1 text-sm">
                After
              </span>
              <span className="absolute top-3 right-3 rounded bg-card/95 px-2 py-1 text-sm">
                Before
              </span>
            </div>
            <label
              className="mt-4 block text-base font-medium"
              htmlFor={`result-split-${result.id}`}
            >
              Compare before and after
            </label>
            <input
              id={`result-split-${result.id}`}
              type="range"
              min="0"
              max="100"
              value={split}
              onChange={(event) => setSplit(Number(event.target.value))}
              className="min-h-11 w-full accent-primary"
            />
            <p className="text-sm text-muted-foreground">
              Move the slider or use the arrow keys. Alignment applies to the
              after photo only.
            </p>
          </div>
        )}
      </div>
      <aside className="flex flex-col gap-5 rounded-2xl border border-border bg-muted/40 p-5">
        <div>
          <p className="eyebrow mb-2 text-primary">
            {result.entryKind === "demo"
              ? "Licensed reference example"
              : "Patient journey"}
          </p>
          <Link
            href={
              result.patientId
                ? `/patients/${result.patientId}`
                : "#reference-credits"
            }
            className="inline-flex min-h-11 items-center gap-2 text-xl font-medium text-primary hover:underline"
          >
            {result.patientName}
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
        <dl className="grid grid-cols-2 gap-5 text-base">
          <Detail label="Body area" value={result.bodyArea} />
          <Detail label="View" value={result.angleName} />
          <Detail label="Category" value={result.category} />
          <Detail label="Procedure / type" value={result.procedure} />
          <Detail label="Product / drug" value={result.product} />
          <Detail
            label="Patient gender"
            value={result.patientGender?.replaceAll("_", " ") ?? ""}
          />
          <Detail
            label="Uploaded"
            value={result.uploadedAt ? galleryDate(result.uploadedAt) : ""}
          />
          <Detail
            label="Alignment"
            value={result.alignment.aligned ? "Marked aligned" : "Not aligned"}
          />
          <Detail
            label="Patient sharing"
            value={result.shared ? "Shared with patient" : "Private to clinic"}
          />
          <Detail label="Saved" value={galleryDate(result.createdAt)} />
        </dl>
        {result.entryKind === "demo" ? (
          <div id="reference-credits" className="space-y-3 text-sm leading-6">
            <p className="font-medium text-primary">
              Licensed reference demonstration. These are not this clinic’s
              patients or treatment results. Dates in this demo are
              illustrative; patient gender is not inferred.
            </p>
            {result.sourceCredits.map((credit) => (
              <p key={credit.url}>
                <a
                  href={credit.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {credit.title}
                </a>{" "}
                by {credit.author} ·{" "}
                <a
                  href={credit.licenseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {credit.license}
                </a>
                . Original image unchanged; preview resized.
              </p>
            ))}
          </div>
        ) : null}
        {result.notes ? (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">
              Treatment notes
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-base leading-7">
              {result.notes}
            </p>
          </div>
        ) : null}
        <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4">
          {result.entryKind === "clinical" && (
            <>
              <Link
                href={treatmentUrl}
                className={buttonVariants({ size: "lg" })}
              >
                Open treatment <ArrowUpRight aria-hidden="true" />
              </Link>
              <Link
                href={`/capture/${result.after.sessionId}`}
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                Review session & alignment
              </Link>
            </>
          )}
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Original photographs stay unchanged. Gallery access is limited to
            your clinic.
          </p>
        </div>
      </aside>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-medium">
        {value || "Not recorded"}
      </dd>
    </div>
  );
}
