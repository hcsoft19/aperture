import { describe, expect, it } from "vitest";

import { operationalEvent } from "@/features/operations/events";
import { healthReport } from "@/features/operations/health";
import {
  SAFE_ERROR_MESSAGE,
  sanitizeError,
} from "@/features/operations/sanitize-error";

describe("operations", () => {
  it("sanitizes an email and a data URL", () => {
    expect(sanitizeError("Upload failed for ada@example.com")).toBe(
      SAFE_ERROR_MESSAGE,
    );
    expect(sanitizeError("Preview failed data:image/jpeg;base64,AAAA")).toBe(
      SAFE_ERROR_MESSAGE,
    );
    expect(SAFE_ERROR_MESSAGE).toBe("Something went wrong.");
  });

  it("sanitizes a UUID and a bearer token", () => {
    expect(
      sanitizeError(
        "Row 11111111-1111-4111-8111-111111111111 could not be stored.",
      ),
    ).toBe(SAFE_ERROR_MESSAGE);
    expect(
      sanitizeError("Authorization Bearer local-demo-token was refused."),
    ).toBe(SAFE_ERROR_MESSAGE);
  });

  it("keeps an error that has no identifier", () => {
    expect(sanitizeError("Storage write failed.")).toBe("Storage write failed.");
  });

  it("rejects an unknown event code", () => {
    expect(operationalEvent("pager_fired")).toEqual({
      ok: false,
      reason: "unknown_event",
    });
  });

  it("accepts a known event without an alert vendor", () => {
    expect(operationalEvent("storage_failed")).toEqual({
      ok: true,
      code: "storage_failed",
      alertVendor: null,
    });
    expect(operationalEvent("camera_unavailable").ok).toBe(true);
    expect(operationalEvent("quota_warning").ok).toBe(true);
  });

  it("reports the app and that the database was not contacted", () => {
    const report = healthReport();

    expect(report).toEqual({
      ok: true,
      checks: ["app", "database-not-contacted"],
    });
    expect(JSON.stringify(report)).not.toMatch(/https?:|@|key|bearer/i);
  });
});
