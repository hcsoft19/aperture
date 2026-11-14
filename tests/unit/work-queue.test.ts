import { describe, expect, it } from "vitest";

import {
  EMPTY_QUEUE_MESSAGE,
  PHOTOGRAPHY_CONSENT_PURPOSE,
  buildQueue,
  type QueueInput,
  type QueuePatient,
  type QueueSession,
} from "@/features/work-queue/queue";

const CLINIC = "clinic-a";
const OTHER = "clinic-b";

function session(overrides: Partial<QueueSession> & Pick<QueueSession, "id" | "status">): QueueSession {
  return {
    organizationId: CLINIC,
    sessionType: "baseline",
    patientId: "patient-ada",
    patientName: "Ada Lovelace",
    treatmentName: "Cheek filler",
    updatedAt: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

function patient(overrides: Partial<QueuePatient> & Pick<QueuePatient, "id" | "name">): QueuePatient {
  return {
    organizationId: CLINIC,
    ...overrides,
  };
}

describe("work queue", () => {
  it("keeps only the requested clinic", () => {
    const input: QueueInput = {
      organizationId: CLINIC,
      sessions: [
        session({ id: "draft-here", status: "draft" }),
        session({
          id: "draft-there",
          status: "draft",
          organizationId: OTHER,
          patientName: "Other Clinic",
          treatmentName: "Secret",
          updatedAt: "2026-12-01T00:00:00Z",
        }),
        session({
          id: "done-there",
          status: "completed",
          organizationId: OTHER,
          patientName: "Other Clinic",
          treatmentName: "Secret",
        }),
        session({ id: "cancelled-here", status: "cancelled", updatedAt: "2026-12-02T00:00:00Z" }),
      ],
      patients: [
        patient({ id: "patient-here", name: "Ada Lovelace" }),
        patient({ id: "patient-there", name: "Other Person", organizationId: OTHER }),
      ],
      consents: [],
    };

    const view = buildQueue(input);
    const hrefs = view.items.map((item) => item.href);

    expect(hrefs).toContain("/capture/draft-here");
    expect(hrefs).toContain("/patients/patient-here");
    expect(hrefs).not.toContain("/capture/draft-there");
    expect(hrefs).not.toContain("/capture/done-there");
    expect(hrefs).not.toContain("/capture/cancelled-here");
    expect(hrefs).not.toContain("/patients/patient-there");
    expect(view.items.map((item) => item.label).join(" ")).not.toContain("Other");
    expect(view.items.map((item) => item.label).join(" ")).not.toContain("Secret");
  });

  it("classifies drafts, completed sessions, and missing consent", () => {
    const input: QueueInput = {
      organizationId: CLINIC,
      sessions: [
        session({
          id: "draft-old",
          status: "draft",
          updatedAt: "2026-01-01T00:00:00Z",
        }),
        session({
          id: "draft-new",
          status: "draft",
          sessionType: "follow_up",
          updatedAt: "2026-06-01T00:00:00Z",
        }),
        session({
          id: "done-1",
          status: "completed",
          sessionType: "follow_up",
          updatedAt: "2026-05-01T00:00:00Z",
        }),
      ],
      patients: [
        patient({ id: "patient-grace", name: "Grace Hopper" }),
        patient({ id: "patient-ada", name: "Ada Lovelace" }),
      ],
      consents: [
        {
          patientId: "patient-ada",
          organizationId: CLINIC,
          purpose: PHOTOGRAPHY_CONSENT_PURPOSE,
          revokedAt: null,
        },
        {
          patientId: "patient-grace",
          organizationId: CLINIC,
          purpose: PHOTOGRAPHY_CONSENT_PURPOSE,
          revokedAt: "2026-04-01T00:00:00Z",
        },
        {
          patientId: "patient-grace",
          organizationId: CLINIC,
          purpose: "Marketing",
          revokedAt: null,
        },
        {
          patientId: "patient-ada",
          organizationId: OTHER,
          purpose: PHOTOGRAPHY_CONSENT_PURPOSE,
          revokedAt: "2026-01-01T00:00:00Z",
        },
      ],
    };

    const view = buildQueue(input);

    expect(view.emptyMessage).toBeNull();
    expect(view.items.map((item) => item.kind)).toEqual([
      "incomplete",
      "incomplete",
      "consent",
      "recent",
    ]);
    expect(view.items[0]).toMatchObject({
      kind: "incomplete",
      href: "/capture/draft-new",
      label: "Continue the follow-up draft for Ada Lovelace, Cheek filler",
    });
    expect(view.items[1]).toMatchObject({
      kind: "incomplete",
      href: "/capture/draft-old",
      label: "Continue the baseline draft for Ada Lovelace, Cheek filler",
    });
    expect(view.items[2]).toMatchObject({
      kind: "consent",
      href: "/patients/patient-grace",
      label: "Record photography consent for Grace Hopper",
    });
    expect(view.items[3]).toMatchObject({
      kind: "recent",
      href: "/capture/done-1",
      label: "Open the completed follow-up for Ada Lovelace, Cheek filler",
    });
  });

  it("returns a calm empty state when nothing is waiting", () => {
    const view = buildQueue({
      organizationId: CLINIC,
      sessions: [],
      patients: [],
      consents: [],
    });

    expect(view.items).toEqual([]);
    expect(view.emptyMessage).toBe(EMPTY_QUEUE_MESSAGE);
    expect(view.emptyMessage).toMatch(/queue is clear/i);
  });

  it("stays empty when every row belongs to another clinic", () => {
    const view = buildQueue({
      organizationId: CLINIC,
      sessions: [
        session({
          id: "draft-there",
          status: "draft",
          organizationId: OTHER,
        }),
      ],
      patients: [patient({ id: "patient-there", name: "Other Person", organizationId: OTHER })],
      consents: [],
    });

    expect(view.items).toEqual([]);
    expect(view.emptyMessage).toBe(EMPTY_QUEUE_MESSAGE);
  });
});
