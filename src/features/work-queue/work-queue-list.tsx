import Link from "next/link";
import { Camera, Images, ShieldAlert, type LucideIcon } from "lucide-react";

import {
  EMPTY_QUEUE_MESSAGE,
  QUEUE_SECTIONS,
  type QueueItem,
  type QueueKind,
  type QueueView,
} from "./queue";

const ICONS: Record<QueueKind, LucideIcon> = {
  incomplete: Camera,
  consent: ShieldAlert,
  recent: Images,
};

export function WorkQueueList({ view }: { view: QueueView }) {
  if (view.items.length === 0) {
    return (
      <p
        role="status"
        className="rounded-2xl bg-secondary px-5 py-8 text-base leading-7 text-foreground"
      >
        {view.emptyMessage ?? EMPTY_QUEUE_MESSAGE}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {QUEUE_SECTIONS.map((section) => {
        const items = view.items.filter((item) => item.kind === section.kind);
        if (items.length === 0) {
          return null;
        }

        const headingId = `work-queue-${section.kind}`;
        return (
          <section
            key={section.kind}
            aria-labelledby={headingId}
            className="flex flex-col gap-3"
          >
            <h2 id={headingId} className="text-xl font-medium">
              {section.title}
            </h2>
            <ul className="flex flex-col gap-3">
              {items.map((item) => (
                <li key={item.id}>
                  <QueueLink item={item} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function QueueLink({ item }: { item: QueueItem }) {
  const Icon = ICONS[item.kind];

  return (
    <Link
      href={item.href}
      className="flex min-h-11 items-center gap-3 rounded-xl bg-card px-4 py-3 text-base leading-6 text-foreground ring-1 ring-foreground/10 transition-colors duration-200 hover:bg-secondary"
    >
      <Icon aria-hidden="true" className="size-5 shrink-0 text-primary" />
      <span>{item.label}</span>
    </Link>
  );
}
