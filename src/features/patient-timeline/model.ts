import { formatChartDate } from "@/features/patients/labels";

export const EMPTY_TIMELINE_MESSAGE = "No treatments or sessions yet.";

export type TimelineViewer = "staff" | "patient";

export type TimelineImageInput = {
  id: string;
  label: string;
  imageReleased: boolean;
  src?: string | null;
};

export type TimelineSessionInput = {
  id: string;
  date: string;
  sessionType: "baseline" | "follow_up";
  images?: TimelineImageInput[];
};

export type TimelineTreatmentInput = {
  id: string;
  name: string;
  date: string | null;
  sessions?: TimelineSessionInput[];
};

export type TimelineInput = {
  viewer: TimelineViewer;
  treatments: TimelineTreatmentInput[];
};

export type TimelineImage = {
  id: string;
  label: string;
  src: string | null;
};

export type TimelineTreatmentEntry = {
  kind: "treatment";
  id: string;
  date: string | null;
  dateLabel: string | null;
  title: string;
};

export type TimelineSessionEntry = {
  kind: "session";
  id: string;
  treatmentId: string;
  treatmentName: string;
  date: string;
  dateLabel: string | null;
  sessionType: "baseline" | "follow_up";
  label: "Baseline" | "Follow-up";
  images: TimelineImage[];
  hiddenImageCount: number;
  hiddenLabel: string | null;
};

export type TimelineEntry = TimelineTreatmentEntry | TimelineSessionEntry;

export type TimelineModel = {
  empty: boolean;
  message: string | null;
  entries: TimelineEntry[];
  hiddenImageCount: number;
};

type SortableEntry = {
  id: string;
  date: string | null;
  kind: TimelineEntry["kind"];
  sessionType: "baseline" | "follow_up" | null;
  entry: TimelineEntry;
};

export function buildTimeline(input: TimelineInput | null | undefined): TimelineModel {
  const treatments = Array.isArray(input?.treatments) ? input.treatments : [];

  if (treatments.length === 0) {
    return {
      empty: true,
      message: EMPTY_TIMELINE_MESSAGE,
      entries: [],
      hiddenImageCount: 0,
    };
  }

  const viewer: TimelineViewer = input?.viewer === "staff" ? "staff" : "patient";
  const sortable: SortableEntry[] = [];
  let hiddenImageCount = 0;

  for (const treatment of treatments) {
    if (!isRecordId(treatment.id) || !treatment.name.trim()) {
      continue;
    }

    if (viewer === "staff" || hasReleasedPhotograph(treatment)) {
      sortable.push({
        id: treatment.id,
        date: treatment.date,
        kind: "treatment",
        sessionType: null,
        entry: {
          kind: "treatment",
          id: treatment.id,
          date: treatment.date,
          dateLabel: formatChartDate(treatment.date),
          title: treatment.name.trim(),
        },
      });
    }

    for (const session of treatment.sessions ?? []) {
      if (!isRecordId(session.id) || (session.sessionType !== "baseline" && session.sessionType !== "follow_up")) {
        continue;
      }

      const images: TimelineImage[] = [];
      let sessionHidden = 0;

      for (const image of session.images ?? []) {
        if (!isRecordId(image.id) || !image.label.trim()) {
          continue;
        }

        if (image.imageReleased !== true) {
          if (viewer === "staff") {
            sessionHidden += 1;
          }
          continue;
        }

        images.push({
          id: image.id,
          label: image.label.trim(),
          src: viewer === "patient" ? patientVisibleSrc(image.src) : displaySrc(image.src),
        });
      }

      if (viewer === "staff") {
        hiddenImageCount += sessionHidden;
      }

      if (viewer === "patient" && images.length === 0 && hasUnreleasedPhotograph(session)) {
        continue;
      }

      sortable.push({
        id: session.id,
        date: session.date,
        kind: "session",
        sessionType: session.sessionType,
        entry: {
          kind: "session",
          id: session.id,
          treatmentId: treatment.id,
          treatmentName: treatment.name.trim(),
          date: session.date,
          dateLabel: formatChartDate(session.date),
          sessionType: session.sessionType,
          label: session.sessionType === "baseline" ? "Baseline" : "Follow-up",
          images,
          hiddenImageCount: viewer === "staff" ? sessionHidden : 0,
          hiddenLabel: viewer === "staff" ? hiddenPhotographLabel(sessionHidden) : null,
        },
      });
    }
  }

  if (sortable.length === 0) {
    return {
      empty: true,
      message: EMPTY_TIMELINE_MESSAGE,
      entries: [],
      hiddenImageCount: 0,
    };
  }

  sortable.sort(compareEntries);

  return {
    empty: false,
    message: null,
    entries: sortable.map((item) => item.entry),
    hiddenImageCount,
  };
}

export function timelineImageAddress(
  viewer: TimelineViewer,
  released: boolean,
  photoId: string,
  patientPreviewUrl?: string | null,
) {
  if (released !== true || !isRecordId(photoId)) {
    return null;
  }

  if (viewer === "staff") {
    return `/api/clinic-photos/${photoId}`;
  }

  return patientVisibleSrc(patientPreviewUrl);
}

function patientVisibleSrc(value: string | null | undefined) {
  const preview = displaySrc(value);
  if (!preview || preview.startsWith("/")) {
    return null;
  }

  return preview;
}

function hasReleasedPhotograph(treatment: TimelineTreatmentInput) {
  return (treatment.sessions ?? []).some((session) =>
    (session.images ?? []).some((image) => isReleasedPhotograph(image)),
  );
}

function hasUnreleasedPhotograph(session: TimelineSessionInput) {
  return (session.images ?? []).some(
    (image) => isPhotograph(image) && image.imageReleased !== true,
  );
}

function isReleasedPhotograph(image: TimelineImageInput) {
  return isPhotograph(image) && image.imageReleased === true;
}

function isPhotograph(image: TimelineImageInput) {
  return isRecordId(image.id) && image.label.trim().length > 0;
}

function hiddenPhotographLabel(count: number) {
  if (count <= 0) {
    return null;
  }

  if (count === 1) {
    return "1 photograph is not released.";
  }

  return `${count} photographs are not released.`;
}

function compareEntries(left: SortableEntry, right: SortableEntry) {
  const leftDate = dateKey(left.date);
  const rightDate = dateKey(right.date);

  if (leftDate !== rightDate) {
    if (leftDate === null) {
      return 1;
    }
    if (rightDate === null) {
      return -1;
    }
    return leftDate < rightDate ? -1 : 1;
  }

  const kindRank = left.kind === "treatment" ? 0 : 1;
  const otherKindRank = right.kind === "treatment" ? 0 : 1;
  if (kindRank !== otherKindRank) {
    return kindRank - otherKindRank;
  }

  const typeRank = left.sessionType === "follow_up" ? 1 : 0;
  const otherTypeRank = right.sessionType === "follow_up" ? 1 : 0;
  if (typeRank !== otherTypeRank) {
    return typeRank - otherTypeRank;
  }

  return left.id.localeCompare(right.id);
}

function dateKey(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const match = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2})?))?/.exec(value);
  if (!match) {
    return null;
  }

  return match[2] ? `${match[1]}T${match[2]}` : match[1];
}

function displaySrc(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("..")) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol === "https:" || url.protocol === "http:") {
      return trimmed;
    }
  } catch {
    return null;
  }

  return null;
}

function isRecordId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
