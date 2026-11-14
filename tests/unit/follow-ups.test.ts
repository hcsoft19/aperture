import { describe, expect, it } from "vitest";

import {
  completeReminder,
  dueReminders,
  dueRemindersInOrganization,
  scheduleReminder,
  type Reminder,
} from "@/features/follow-ups/reminders";
import {
  completeReminderSchema,
  scheduleReminderSchema,
} from "@/features/follow-ups/schema";

const treatmentId = "44444444-4444-4444-8444-444444444444";
const studioId = "33333333-3333-4333-8333-333333333333";
const otherClinicId = "55555555-5555-4555-8555-555555555555";
const actorId = "11111111-1111-4111-8111-111111111111";

function reminder(overrides: Partial<Reminder> & Pick<Reminder, "id" | "dueOn">): Reminder {
  return {
    organizationId: studioId,
    treatmentId,
    note: null,
    completedAt: null,
    createdBy: actorId,
    createdAt: "2026-11-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("scheduleReminder", () => {
  it("sets the due date the given number of days after the starting date", () => {
    expect(
      scheduleReminder({ treatmentId, fromDate: "2026-11-14", followUpDays: 14 }),
    ).toEqual({ treatmentId, dueOn: "2026-11-28" });
  });

  it("keeps the starting date when the interval is zero", () => {
    expect(
      scheduleReminder({ treatmentId, fromDate: "2026-11-14", followUpDays: 0 }).dueOn,
    ).toBe("2026-11-14");
  });

  it("crosses month, leap-day, and year boundaries", () => {
    expect(scheduleReminder({ treatmentId, fromDate: "2024-02-28", followUpDays: 1 }).dueOn).toBe(
      "2024-02-29",
    );
    expect(scheduleReminder({ treatmentId, fromDate: "2025-02-28", followUpDays: 1 }).dueOn).toBe(
      "2025-03-01",
    );
    expect(scheduleReminder({ treatmentId, fromDate: "2026-12-31", followUpDays: 1 }).dueOn).toBe(
      "2027-01-01",
    );
  });

  it("rejects a treatment, date, or day count that cannot be scheduled", () => {
    expect(() =>
      scheduleReminder({ treatmentId: "sam", fromDate: "2026-11-14", followUpDays: 1 }),
    ).toThrow(/treatment/i);
    expect(() =>
      scheduleReminder({ treatmentId, fromDate: "2026-02-31", followUpDays: 1 }),
    ).toThrow(/date/i);
    expect(() =>
      scheduleReminder({ treatmentId, fromDate: "2026-11-14", followUpDays: -1 }),
    ).toThrow(/days/i);
    expect(() =>
      scheduleReminder({ treatmentId, fromDate: "2026-11-14", followUpDays: 1.5 }),
    ).toThrow(/days/i);
  });
});

describe("dueReminders", () => {
  const open = reminder({ id: "10000000-0000-4000-8000-000000000001", dueOn: "2026-11-13" });
  const today = reminder({ id: "10000000-0000-4000-8000-000000000002", dueOn: "2026-11-14" });
  const later = reminder({ id: "10000000-0000-4000-8000-000000000003", dueOn: "2026-11-20" });
  const finished = reminder({
    id: "10000000-0000-4000-8000-000000000004",
    dueOn: "2026-11-01",
    completedAt: "2026-11-10T15:00:00.000Z",
  });

  it("returns overdue and same-day reminders and leaves future ones out", () => {
    expect(dueReminders([later, open, today, finished], "2026-11-14").map((item) => item.id)).toEqual([
      open.id,
      today.id,
    ]);
  });

  it("removes a reminder once it has a completion time", () => {
    const completed = completeReminder(open, "2026-11-14T18:30:00.000Z");
    expect(completed.completedAt).toBe("2026-11-14T18:30:00.000Z");
    expect(dueReminders([completed, today], "2026-11-14").map((item) => item.id)).toEqual([today.id]);
  });

  it("keeps the first completion time", () => {
    const completed = completeReminder(open, "2026-11-14T18:30:00.000Z");
    expect(completeReminder(completed, "2026-11-15T18:30:00.000Z").completedAt).toBe(
      "2026-11-14T18:30:00.000Z",
    );
  });

  it("stays inside one organization", () => {
    const other = reminder({
      id: "10000000-0000-4000-8000-000000000009",
      organizationId: otherClinicId,
      dueOn: "2026-11-01",
    });

    const due = dueRemindersInOrganization([open, other], "2026-11-14", studioId);
    expect(due.map((item) => item.id)).toEqual([open.id]);
    expect(dueRemindersInOrganization([open], "2026-11-14", "not-a-clinic")).toEqual([]);
  });
});

describe("reminder forms", () => {
  it("accepts a due interval and an empty note", () => {
    expect(
      scheduleReminderSchema.safeParse({
        treatmentId,
        fromDate: "2026-11-14",
        followUpDays: 14,
        note: "   ",
      }).success,
    ).toBe(true);
  });

  it("rejects a missing treatment and a note that is too long", () => {
    expect(
      scheduleReminderSchema.safeParse({
        treatmentId: "",
        fromDate: "2026-11-14",
        followUpDays: 14,
        note: "",
      }).success,
    ).toBe(false);
    expect(
      scheduleReminderSchema.safeParse({
        treatmentId,
        fromDate: "2026-11-14",
        followUpDays: 14,
        note: "n".repeat(501),
      }).success,
    ).toBe(false);
  });

  it("requires a reminder id to complete", () => {
    expect(completeReminderSchema.safeParse({ reminderId: openId() }).success).toBe(true);
    expect(completeReminderSchema.safeParse({ reminderId: "nope" }).success).toBe(false);
  });
});

function openId() {
  return "10000000-0000-4000-8000-000000000001";
}
