import Image from "next/image";
import Link from "next/link";
export type SessionPhotograph = {
  id: string;
  sessionId: string;
  angleName: string;
};
export function SessionPhotographs({
  photos,
  openPhotographs = false,
  patientId,
  returnTo,
}: {
  photos: SessionPhotograph[];
  openPhotographs?: boolean;
  patientId?: string;
  returnTo?: string;
}) {
  return (
    <ul
      aria-label="Saved session photographs"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3"
    >
      {photos.map((photo, index) => (
        <li
          key={photo.id}
          className={`overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 ${index === 0 ? "col-span-2 ring-2 ring-primary sm:col-span-3" : ""}`}
        >
          <Link
            aria-label={`View ${photo.angleName} photograph`}
            prefetch={false}
            target={openPhotographs ? "_blank" : undefined}
            rel={openPhotographs ? "noopener noreferrer" : undefined}
            href={
              openPhotographs
                ? `/api/clinic-photos/${photo.id}`
                : `/capture/${photo.sessionId}`
            }
            className="group block"
          >
            <div className={`relative bg-muted ${index === 0 ? "aspect-[3/4] max-h-[70dvh]" : "aspect-[3/4]"}`}>
              <Image
                src={`/api/clinic-photos/${photo.id}`}
                alt={photo.angleName}
                fill
                unoptimized
                sizes="(min-width: 768px) 640px, 100vw"
                className="object-contain"
              />
              {index === 0 ? (
                <span className="absolute top-3 left-3 rounded-full bg-card/95 px-3 py-1 text-sm font-medium text-primary">
                  Uploaded photograph
                </span>
              ) : null}
            </div>
          </Link>
          {patientId ? (
            <Link
              href={`/patients/${patientId}/photos/${photo.id}/edit?from=${encodeURIComponent(returnTo ?? `/capture/${photo.sessionId}`)}`}
              className="flex min-h-11 w-full items-center justify-center bg-primary px-3 text-base font-medium text-primary-foreground"
            >
              Edit {photo.angleName}
            </Link>
          ) : (
            <span className="flex min-h-11 items-center px-3 text-base font-medium">{photo.angleName}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
