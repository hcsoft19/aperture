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
}: {
  photos: SessionPhotograph[];
  openPhotographs?: boolean;
}) {
  return (
    <ul
      aria-label="Saved session photographs"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3"
    >
      {photos.map((photo) => (
        <li key={photo.id}>
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
            className="group block overflow-hidden rounded-xl border border-border bg-card"
          >
            <div className="relative aspect-[3/4] bg-muted">
              <Image
                src={`/api/clinic-photos/${photo.id}`}
                alt={photo.angleName}
                fill
                unoptimized
                sizes="(min-width: 768px) 260px, 45vw"
                className="object-contain"
              />
            </div>
            <span className="flex min-h-11 items-center p-3 text-sm font-medium text-primary">
              {photo.angleName}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
