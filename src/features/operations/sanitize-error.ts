export const SAFE_ERROR_MESSAGE = "Something went wrong.";

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const UUID =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const BEARER = /\bBearer\s+[A-Za-z0-9\-._~+/]{8,}={0,2}/i;
const DATA_URL = /data:(?:[^,\s]+)?,[^\s]+/i;

const SENSITIVE = [EMAIL, UUID, BEARER, DATA_URL];

/**
 * Returns a fixed sentence when the error string contains an email address,
 * UUID, bearer token, or data URL. A string without those stays unchanged.
 */
export function sanitizeError(message: string): string {
  if (SENSITIVE.some((pattern) => pattern.test(message))) {
    return SAFE_ERROR_MESSAGE;
  }

  return message;
}
