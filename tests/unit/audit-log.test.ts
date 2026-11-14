import { describe, expect, it } from "vitest";

import { incidentNote } from "@/features/audit-log/incident";
import { append, list, type AuditEvent } from "@/features/audit-log/model";

const organizationA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const organizationB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const actorId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const subjectA = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const subjectB = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const createdAt = "2026-11-14T15:00:00.000Z";

const actions = [
  ["consent_granted", "granted"],
  ["consent_withdrawn", "withdrawn"],
  ["progress_released", "released"],
  ["progress_revoked", "revoked"],
  ["privacy_export_requested", "requested"],
  ["privacy_deletion_requested", "requested"],
] as const;

describe("audit log", () => {
  it("append is immutable", () => {
    const detail: { status: string } = { status: "granted" };
    const first = append([], {
      organizationId: organizationA,
      actorId,
      action: "consent_granted",
      subjectId: subjectA,
      createdAt,
      detail,
    });

    detail.status = "withdrawn";

    const withoutDetail = append([], {
      organizationId: organizationA,
      actorId,
      action: "privacy_export_requested",
      subjectId: subjectA,
      createdAt,
    });
    expect(withoutDetail[0].detail).toEqual({});

    expect(first).toHaveLength(1);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first[0])).toBe(true);
    expect(Object.isFrozen(first[0].detail)).toBe(true);
    expect(first[0].detail.status).toBe("granted");
    expect(() => {
      (first[0] as { action: string }).action = "consent_withdrawn";
    }).toThrow(TypeError);
    expect(() => {
      (first as AuditEvent[]).pop();
    }).toThrow(TypeError);

    let events: readonly AuditEvent[] = [];
    const snapshots: Array<readonly AuditEvent[]> = [];
    for (const [action, status] of actions) {
      snapshots.push(events);
      events = append(events, {
        organizationId: organizationA,
        actorId,
        action,
        subjectId: subjectA,
        createdAt,
        detail: { status },
      });
    }

    expect(snapshots.map((snapshot) => snapshot.length)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(events).toHaveLength(6);
    expect(events.map((event) => event.action)).toEqual(actions.map(([action]) => action));
    expect(snapshots[1][0].action).toBe("consent_granted");
    expect(events[0]).toBe(snapshots[1][0]);
  });

  it("rejects a photograph payload", () => {
    const kept = append([], {
      organizationId: organizationA,
      actorId,
      action: "consent_granted",
      subjectId: subjectA,
      createdAt,
      detail: { status: "granted" },
    });
    const photograph = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD";
    const base = {
      organizationId: organizationA,
      actorId,
      action: "consent_granted" as const,
      subjectId: subjectA,
      createdAt,
    };

    expect(() =>
      append(kept, { ...base, detail: { status: photograph } }),
    ).toThrow(/cannot be recorded/);
    expect(() =>
      append(kept, { ...base, photograph }),
    ).toThrow(/cannot be recorded/);
    expect(() =>
      append(kept, {
        ...base,
        detail: { bytes: Uint8Array.from([255, 216, 255, 224]) },
      }),
    ).toThrow(/cannot be recorded/);
    expect(() =>
      append(kept, { ...base, detail: { contact: "ada@example.com" } }),
    ).toThrow(/cannot be recorded/);
    expect(() =>
      append(kept, { ...base, detail: { label: "Sample Person" } }),
    ).toThrow(/cannot be recorded/);
    expect(() =>
      append(kept, { ...base, detail: { file: "clinic/photos/original.jpg" } }),
    ).toThrow(/cannot be recorded/);
    expect(() =>
      append(kept, { ...base, detail: { patient_name: "granted" } }),
    ).toThrow(/cannot be recorded/);
    expect(kept).toHaveLength(1);
    expect(kept[0].detail).toEqual({ status: "granted" });
    expect(list(kept, organizationA)).toHaveLength(1);
  });

  it("does not mix another organization into a filtered list", () => {
    const events = append(
      append([], {
        organizationId: organizationA,
        actorId,
        action: "progress_released",
        subjectId: subjectA,
        createdAt,
        detail: { status: "released" },
      }),
      {
        organizationId: organizationB,
        actorId,
        action: "progress_revoked",
        subjectId: subjectB,
        createdAt,
        detail: { status: "revoked" },
      },
    );

    const listed = list(events, organizationA);

    expect(events).toHaveLength(2);
    expect(listed).toHaveLength(1);
    expect(listed.every((event) => event.organizationId === organizationA)).toBe(true);
    expect(listed.some((event) => event.organizationId === organizationB)).toBe(false);
    expect(listed.some((event) => event.subjectId === subjectB)).toBe(false);
    expect(list(events, organizationB).map((event) => event.organizationId)).toEqual([
      organizationB,
    ]);
  });

  it("returns an incident checklist without assigning a team", () => {
    const note = incidentNote();

    expect(note.steps).toEqual([
      "Stop sharing.",
      "Preserve the audit row.",
      "Do not put photographs in the note.",
    ]);
    expect(note.disclaimer).toBe(
      "This checklist does not mean an incident team exists.",
    );
  });
});
