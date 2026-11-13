import { createHash, randomBytes } from "node:crypto";

export function createInvitationToken() {
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}
