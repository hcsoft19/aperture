import { describe, expect, it } from "vitest";

import { invitationSchema } from "@/features/sharing/schemas";
import { createInvitationToken } from "@/features/sharing/token";

describe("patient invitations", () => {
  it("creates a token the database can store as a hash", () => {
    const { token, tokenHash } = createInvitationToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash).not.toBe(token);
  });

  it("requires a real email address", () => {
    expect(invitationSchema.safeParse({ patientId: "44444444-4444-4444-8444-444444444444", email: "not-an-email" }).success).toBe(false);
    expect(invitationSchema.safeParse({ patientId: "44444444-4444-4444-8444-444444444444", email: "nia.chen@example.com" }).success).toBe(true);
  });
});
