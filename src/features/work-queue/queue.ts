export const PHOTOGRAPHY_CONSENT_PURPOSE = "Clinical photography";

export const EMPTY_QUEUE_MESSAGE =
  "The queue is clear. Draft sessions, completed sessions, and missing photography consent will appear here.";

export const QUEUE_SECTIONS = [
  { kind: "incomplete", title: "Unfinished sessions" },
  { kind: "consent", title: "Missing photography consent" },
  { kind: "recent", title: "Recent sessions" },
] as const;

export type QueueKind = (typeof QUEUE_SECTIONS)[number]["kind"];

export type QueueSession = {
  id: string;
  organizationId: string;
  status: "draft" | "completed" | "cancelled";
  sessionType: "baseline" | "follow_up";
  patientId: string;
  patientName: string;
  treatmentName: string;
  updatedAt: string;
};

export type QueuePatient = {
  id: string;
  organizationId: string;
  name: string;
};

export type QueueConsent = {
  patientId: string;
  organizationId: string;
  purpose: string;
  revokedAt: string | null;
};

export type QueueInput = {
  organizationId: string;
  sessions: QueueSession[];
  patients: QueuePatient[];
  consents: QueueConsent[];
};

export type QueueItem = {
  id: string;
  kind: QueueKind;
  label: string;
  href: string;
};

export type QueueView = {
  items: QueueItem[];
  emptyMessage: string | null;
};

export function buildQueue(input: QueueInput): QueueView {
  const sessions = input.sessions.filter(
    (session) => session.organizationId === input.organizationId,
  );
  const patients = input.patients.filter(
    (patient) => patient.organizationId === input.organizationId,
  );

  const incomplete = sessions
    .filter((session) => session.status === "draft")
    .sort(byMostRecentlyUpdated)
    .map((session) =>
      queueItem(
        "incomplete",
        session.id,
        sessionLabel(session, "incomplete"),
        captureHref(session.id),
      ),
    );

  const consent = patients
    .filter(
      (patient) =>
        !hasActivePhotographyConsent(
          patient.id,
          input.organizationId,
          input.consents,
        ),
    )
    .sort((left, right) => left.name.localeCompare(right.name, "en"))
    .map((patient) =>
      queueItem(
        "consent",
        patient.id,
        `Record photography consent for ${named(patient.name, "this patient")}`,
        patientHref(patient.id),
      ),
    );

  const recent = sessions
    .filter((session) => session.status === "completed")
    .sort(byMostRecentlyUpdated)
    .map((session) =>
      queueItem(
        "recent",
        session.id,
        sessionLabel(session, "recent"),
        captureHref(session.id),
      ),
    );

  const items = [...incomplete, ...consent, ...recent];

  return {
    items,
    emptyMessage: items.length === 0 ? EMPTY_QUEUE_MESSAGE : null,
  };
}

function hasActivePhotographyConsent(
  patientId: string,
  organizationId: string,
  consents: QueueConsent[],
) {
  return consents.some(
    (consent) =>
      consent.patientId === patientId &&
      consent.organizationId === organizationId &&
      consent.purpose === PHOTOGRAPHY_CONSENT_PURPOSE &&
      consent.revokedAt === null,
  );
}

function sessionLabel(session: QueueSession, kind: "incomplete" | "recent") {
  const visit = session.sessionType === "baseline" ? "baseline" : "follow-up";
  const patient = named(session.patientName, "this patient");
  const treatment = named(session.treatmentName, "this treatment");

  if (kind === "incomplete") {
    return `Continue the ${visit} draft for ${patient}, ${treatment}`;
  }

  return `Open the completed ${visit} for ${patient}, ${treatment}`;
}

function queueItem(
  kind: QueueKind,
  sourceId: string,
  label: string,
  href: string,
): QueueItem {
  return {
    id: `${kind}:${sourceId}`,
    kind,
    label,
    href,
  };
}

function captureHref(sessionId: string) {
  return `/capture/${encodeURIComponent(sessionId)}`;
}

function patientHref(patientId: string) {
  return `/patients/${encodeURIComponent(patientId)}`;
}

function named(value: string, fallback: string) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function byMostRecentlyUpdated(left: QueueSession, right: QueueSession) {
  if (left.updatedAt === right.updatedAt) {
    return left.id.localeCompare(right.id);
  }

  return left.updatedAt < right.updatedAt ? 1 : -1;
}
