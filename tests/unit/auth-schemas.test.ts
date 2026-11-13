import { describe, expect, it } from "vitest";

import { loginSchema, registerSchema } from "@/features/auth/schemas";

describe("auth schemas", () => {
  it("accepts a complete sign-in", () => {
    expect(
      loginSchema.safeParse({ email: "ada@clinic.example", password: "secret" }).success,
    ).toBe(true);
  });

  it("rejects a malformed email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "secret" });
    expect(result.success).toBe(false);
  });

  it("requires matching passwords when creating an account", () => {
    const result = registerSchema.safeParse({
      email: "ada@clinic.example",
      password: "long-enough",
      confirmPassword: "different",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("confirmPassword"))).toBe(
        true,
      );
    }
  });
});
