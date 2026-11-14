import { describe, expect, it } from "vitest";

import { readinessChecklist } from "@/features/support/readiness";

describe("support readiness", () => {
  it("mentions synthetic records", () => {
    const checklist = readinessChecklist();
    const text = checklist.join(" ");

    expect(text).toMatch(/synthetic records/);
    expect(text).toMatch(/Real patients are not allowed yet/);
    expect(text).toMatch(
      /Consent is separate for clinical photography, portal sharing, and marketing/,
    );
    expect(text).toMatch(/Support is the clinic administrator/);
    expect(text).not.toMatch(/@|help desk|https?:/i);
    expect(checklist).toHaveLength(4);
  });
});
