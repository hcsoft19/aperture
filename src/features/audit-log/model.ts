import { z } from "zod";

/** Append-only audit events. Detail holds short status strings and never a photograph. */

const AUDIT_ACTIONS = [
  "consent_granted",
  "consent_withdrawn",
  "progress_released",
  "progress_revoked",
  "privacy_export_requested",
  "privacy_deletion_requested",
] as const;

const AUDIT_STATUSES = [
  "granted",
  "withdrawn",
  "released",
  "revoked",
  "requested",
] as const;

const REJECTED = "This audit event cannot be recorded.";
const STATUS_KEY = /^[a-z][a-z0-9_]{0,31}$/;
const SENSITIVE_KEY =
  /(name|email|e-mail|path|photo|image|byte|file|url|portrait|patient|storage)/;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditStatus = (typeof AUDIT_STATUSES)[number];

export type AuditEvent = {
  readonly organizationId: string;
  readonly actorId: string;
  readonly action: AuditAction;
  readonly subjectId: string;
  readonly createdAt: string;
  readonly detail: Readonly<Record<string, string>>;
};

const appendSchema = z
  .object({
    organizationId: z.uuid(),
    actorId: z.uuid(),
    action: z.enum(AUDIT_ACTIONS),
    subjectId: z.uuid(),
    createdAt: z.iso.datetime({ offset: true }),
    detail: z
      .record(z.string(), z.unknown())
      .refine(detailIsSafe, "Audit details can only hold short status strings.")
      .transform((detail) => {
        const copy: Record<string, AuditStatus> = {};
        for (const [key, value] of Object.entries(detail)) {
          copy[key] = value as AuditStatus;
        }
        return copy;
      })
      .optional()
      .default(() => ({})),
  })
  .strict();

export function append(
  events: readonly AuditEvent[],
  input: unknown,
): readonly AuditEvent[] {
  if (!Array.isArray(events) || !events.every(isAuditEvent)) {
    throw new Error(REJECTED);
  }

  const parsed = appendSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(REJECTED);
  }

  const event = Object.freeze({
    organizationId: parsed.data.organizationId.toLowerCase(),
    actorId: parsed.data.actorId.toLowerCase(),
    action: parsed.data.action,
    subjectId: parsed.data.subjectId.toLowerCase(),
    createdAt: parsed.data.createdAt,
    detail: Object.freeze({ ...parsed.data.detail }),
  });

  return Object.freeze([...events, event]);
}

export function list(
  events: readonly AuditEvent[],
  organizationId: string,
): readonly AuditEvent[] {
  const organization = z.uuid().safeParse(organizationId);
  if (!Array.isArray(events) || !organization.success) {
    return Object.freeze([]);
  }

  const organizationKey = organization.data.toLowerCase();
  return Object.freeze(
    events.filter(
      (event) =>
        isAuditEvent(event) && event.organizationId === organizationKey,
    ),
  );
}

function isAuditEvent(value: unknown): value is AuditEvent {
  return appendSchema.safeParse(value).success && !hasForbiddenPayload(value);
}

function detailIsSafe(detail: Record<string, unknown>): boolean {
  const entries = Object.entries(detail);
  if (entries.length > 8) {
    return false;
  }

  return entries.every(([key, value]) => isStatusKey(key) && isStatusValue(value));
}

function isStatusKey(key: string): boolean {
  return STATUS_KEY.test(key) && !SENSITIVE_KEY.test(key);
}

function isStatusValue(value: unknown): value is AuditStatus {
  return (
    typeof value === "string" &&
    (AUDIT_STATUSES as readonly string[]).includes(value) &&
    !hasForbiddenPayload(value)
  );
}

function hasForbiddenPayload(value: unknown): boolean {
  if (typeof value === "string") {
    return (
      value.length > 64 ||
      /data:/i.test(value) ||
      value.includes("@") ||
      /[\\/]/.test(value) ||
      /\.(?:jpe?g|png|gif|webp|heic|heif|bmp|tiff?)\b/i.test(value) ||
      /^(?:\/9j\/|iVBORw0KGgo|R0lGOD|UklGR)/.test(value) ||
      /\s/.test(value)
    );
  }

  if (
    value instanceof Uint8Array ||
    value instanceof Uint8ClampedArray ||
    value instanceof ArrayBuffer
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return (
      value.some((entry) => hasForbiddenPayload(entry)) ||
      (value.length > 0 && value.every((entry) => typeof entry === "number"))
    );
  }

  if (value && typeof value === "object") {
    return Object.entries(value).some(
      ([key, entry]) =>
        SENSITIVE_KEY.test(key) ||
        hasForbiddenPayload(key) ||
        hasForbiddenPayload(entry),
    );
  }

  return value != null && typeof value !== "boolean" && typeof value !== "number";
}
