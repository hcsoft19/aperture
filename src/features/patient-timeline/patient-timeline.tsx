import Image from "next/image";
import Link from "next/link";

import type { TimelineImage, TimelineModel } from "@/features/patient-timeline/model";

export function PatientTimeline({ timeline }: { timeline: TimelineModel }) {
  if (timeline.empty) {
    return <p className="text-base leading-7 text-muted-foreground">{timeline.message}</p>;
  }

  return (
    <ol aria-label="Treatment timeline" className="flex flex-col gap-6 border-l-2 border-primary/30 pl-5">
      {timeline.entries.map((entry) =>
        entry.kind === "treatment" ? (
          <li key={`treatment-${entry.id}`} className="relative">
            <span
              aria-hidden="true"
              className="absolute top-2 -left-[1.65rem] size-3 rounded-full bg-primary"
            />
            <h2 className="text-lg font-semibold">{entry.title}</h2>
            <p className="text-base text-muted-foreground">{entry.dateLabel ?? "Date not recorded"}</p>
          </li>
        ) : (
          <li key={`session-${entry.id}`} className="relative">
            <span
              aria-hidden="true"
              className="absolute top-5 -left-[1.65rem] size-3 rounded-full bg-secondary ring-2 ring-primary"
            />
            <article className="flex flex-col gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
              <div>
                <h3 className="text-base font-medium">{entry.label}</h3>
                <p className="text-base text-muted-foreground">{entry.treatmentName}</p>
                <p className="text-base text-muted-foreground">
                  {entry.dateLabel ? <time dateTime={entry.date}>{entry.dateLabel}</time> : "Date not recorded"}
                </p>
              </div>
              {entry.images.length > 0 ? (
                <ul aria-label={`${entry.label} photographs`} className="grid grid-cols-2 gap-3">
                  {entry.images.map((image) => (
                    <li key={image.id}>
                      <ReleasedImage image={image} />
                    </li>
                  ))}
                </ul>
              ) : entry.hiddenLabel ? null : (
                <p className="text-base leading-7 text-muted-foreground">No photographs in this visit.</p>
              )}
              {entry.hiddenLabel ? (
                <p className="text-base leading-7 text-muted-foreground">{entry.hiddenLabel}</p>
              ) : null}
            </article>
          </li>
        ),
      )}
    </ol>
  );
}

function ReleasedImage({ image }: { image: TimelineImage }) {
  if (!image.src) {
    return (
      <p className="flex min-h-11 items-center rounded-lg bg-secondary px-3 text-base text-secondary-foreground">
        {image.label}
      </p>
    );
  }

  if (image.src.startsWith("/")) {
    return (
      <Link
        href={image.src}
        prefetch={false}
        aria-label={`View ${image.label}`}
        className="block min-h-11 overflow-hidden rounded-lg"
      >
        <Image
          src={image.src}
          alt=""
          width={600}
          height={800}
          unoptimized
          className="aspect-[3/4] w-full bg-muted object-contain"
        />
        <span className="flex min-h-11 items-center text-base">{image.label}</span>
      </Link>
    );
  }

  return (
    <figure>
      <Image
        src={image.src}
        alt={image.label}
        width={600}
        height={800}
        unoptimized
        className="aspect-[3/4] w-full rounded-lg bg-muted object-contain"
      />
      <figcaption className="mt-2 text-base">{image.label}</figcaption>
    </figure>
  );
}
