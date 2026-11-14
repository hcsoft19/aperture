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
    expect(
      toAuthErrorMessage(
        "over_email_send_rate_limit",
        "The reset email could not be sent. Try again.",
      ),
    ).toBe("Too many attempts. Wait a moment and try again.");
    expect(
      toAuthErrorMessage(
        "same_password",
        "The password could not be updated. Request a new reset link.",
      ),
    ).toBe("Choose a different password. This one is already in use.");
  });

  it("hides unrecognized auth codes", () => {
    expect(toAuthErrorMessage("something_internal", "Try again.")).toBe("Try again.");
    expect(toAuthErrorMessage(undefined, "Try again.")).toBe("Try again.");
  });
});
