import { describe, expect, it } from "vitest";

import {
  memberEmailSchema,
  organizationNameSchema,
} from "@/features/organizations/schemas";

describe("organization schemas", () => {
  it("accepts a clinic name", () => {
    expect(organizationNameSchema.safeParse({ name: "  Example Studio  " }).success).toBe(true);
  });

  it("rejects a one-character clinic name", () => {
    expect(organizationNameSchema.safeParse({ name: "A" }).success).toBe(false);
  });

  it("rejects an invalid member email", () => {
    expect(memberEmailSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });
});
