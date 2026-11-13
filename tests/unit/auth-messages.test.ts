import { describe, expect, it } from "vitest";

import { toAuthErrorMessage } from "@/features/auth/messages";

describe("auth error messages", () => {
  it("maps known auth codes to plain language", () => {
    expect(toAuthErrorMessage("invalid_credentials", "fallback")).toBe(
      "Email or password is incorrect.",
    );
    expect(toAuthErrorMessage("email_not_confirmed", "fallback")).toBe(
      "Confirm your email before signing in.",
    );
  });

  it("hides unrecognized auth codes", () => {
    expect(toAuthErrorMessage("something_internal", "Try again.")).toBe("Try again.");
    expect(toAuthErrorMessage(undefined, "Try again.")).toBe("Try again.");
  });
});
