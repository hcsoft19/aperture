import { describe, expect, it } from "vitest";

import {
  buildTimeline,
  EMPTY_TIMELINE_MESSAGE,
  type TimelineInput,
} from "@/features/patient-timeline/model";

const records = {
  viewer: "staff",
  treatments: [
    {
      id: "treatment-later",
      name: "Laser",
      date: "2024-06-01",
      sessions: [
        {
          id: "follow-up-june",
          date: "2024-08-02",
          sessionType: "follow_up",
          images: [
            {
              id: "released-front",
              label: "Front",
              imageReleased: true,
              src: "/api/clinic-photos/released-front",
            },
            {
              id: "hidden-side",
              label: "Side",
              imageReleased: false,
              src: "org/session/side.jpg",
            },
          ],
        },
        {
          id: "baseline-june",
          date: "2024-06-01",
          sessionType: "baseline",
          images: [],
        },
      ],
    },
    {
      id: "treatment-earlier",
      name: "Filler",
      date: "2024-01-15",
      sessions: [
        {
          id: "same-day-follow-up",
          date: "2024-02-01",
          sessionType: "follow_up",
          images: [],
        },
        {
          id: "same-day-baseline",
          date: "2024-02-01",
          sessionType: "baseline",
          images: [
            {
              id: "released-oblique",
              label: "Oblique",
              imageReleased: true,
              src: "clinic/private/oblique.jpg",
            },
          ],
        },
      ],
    },
  ],
} satisfies TimelineInput;

describe("patient timeline", () => {
  it("orders treatments and sessions by date and labels baseline and follow-up", () => {
    const timeline = buildTimeline(records);

    expect(timeline.empty).toBe(false);
    expect(timeline.entries.map((entry) => entry.id)).toEqual([
      "treatment-earlier",
      "same-day-baseline",
      "same-day-follow-up",
      "treatment-later",
      "baseline-june",
      "follow-up-june",
    ]);
    expect(
      timeline.entries
        .filter((entry) => entry.kind === "session")
        .map((entry) => entry.label),
    ).toEqual(["Baseline", "Follow-up", "Baseline", "Follow-up"]);
    expect(timeline.entries[1]).toMatchObject({
      kind: "session",
      label: "Baseline",
      dateLabel: "1 Feb 2024",
    });
  });

  it("shows released images and counts unreleased images for staff only", () => {
    const staff = buildTimeline(records);
    const patient = buildTimeline({ ...records, viewer: "patient" });
    const followUp = staff.entries.find((entry) => entry.id === "follow-up-june");
    const patientFollowUp = patient.entries.find((entry) => entry.id === "follow-up-june");
    const baseline = staff.entries.find((entry) => entry.id === "same-day-baseline");

    expect(followUp?.kind).toBe("session");
    if (followUp?.kind !== "session" || patientFollowUp?.kind !== "session" || baseline?.kind !== "session") {
      throw new Error("Expected session entries.");
    }

    expect(followUp.images.map((image) => image.id)).toEqual(["released-front"]);
    expect(followUp.images[0]?.src).toBe("/api/clinic-photos/released-front");
    expect(followUp.hiddenImageCount).toBe(1);
    expect(followUp.hiddenLabel).toBe("1 photograph is not released.");
    expect(baseline.images).toEqual([
      { id: "released-oblique", label: "Oblique", src: null },
    ]);
    expect(staff.hiddenImageCount).toBe(1);
    expect(JSON.stringify(staff)).not.toContain("side.jpg");
    expect(JSON.stringify(staff)).not.toContain("oblique.jpg");

    expect(patientFollowUp.images.map((image) => image.id)).toEqual(["released-front"]);
    expect(patientFollowUp.hiddenImageCount).toBe(0);
    expect(patientFollowUp.hiddenLabel).toBeNull();
    expect(patient.hiddenImageCount).toBe(0);
    expect(JSON.stringify(patient)).not.toContain("side.jpg");
  });

  it("returns an empty state message for empty input", () => {
    expect(buildTimeline({ viewer: "staff", treatments: [] })).toEqual({
      empty: true,
      message: EMPTY_TIMELINE_MESSAGE,
      entries: [],
      hiddenImageCount: 0,
    });
    expect(buildTimeline(null)).toEqual({
      empty: true,
      message: EMPTY_TIMELINE_MESSAGE,
      entries: [],
      hiddenImageCount: 0,
    });
    expect(EMPTY_TIMELINE_MESSAGE).toBe("No treatments or sessions yet.");
  });
});
