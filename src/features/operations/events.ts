export const OPERATIONAL_EVENT_CODES = [
  "storage_failed",
  "camera_unavailable",
  "quota_warning",
] as const;

export type OperationalEventCode = (typeof OPERATIONAL_EVENT_CODES)[number];

export type OperationalEventResult =
  | {
      ok: true;
      code: OperationalEventCode;
      alertVendor: null;
    }
  | {
      ok: false;
      reason: "unknown_event";
    };

function isOperationalEventCode(code: string): code is OperationalEventCode {
  return (OPERATIONAL_EVENT_CODES as readonly string[]).includes(code);
}

/**
 * Accepts a known operational code. No alert vendor is configured.
 */
export function operationalEvent(code: string): OperationalEventResult {
  if (!isOperationalEventCode(code)) {
    return { ok: false, reason: "unknown_event" };
  }

  return { ok: true, code, alertVendor: null };
}
