import { z } from "zod";

import { isUuid } from "@/lib/ids";

/** Shown when an export manifest is ready for the integrator to store. */
export const EXPORT_READY_MESSAGE = "The export is ready.";

/** Shown when a deletion request is recorded and nothing is removed. */
export const DELETION_RECORDED_MESSAGE =
  "The deletion request was recorded. Photographs were not deleted.";

export const DELETION_REQUEST_STATUS = "requested" as const;

export const privacyRefusalMessage = {
  cross_organization: "This request is for another clinic.",
  unauthorized: "Only a clinic administrator can make this request.",
  image_bytes: "The export cannot include image bytes.",
  storage_path: "The export cannot include a storage path.",
  signed_url: "The export cannot include a signed URL.",
  embedding: "The export cannot include an embedding.",
  invalid: "This request could not be prepared.",
  backup_retention:
    "Automatic deletion is not available. This prototype cannot purge backups.",
} as const;

export type PrivacyRefusal = keyof typeof privacyRefusalMessage;

export type PrivacyFailure = {
  ok: false;
  reason: PrivacyRefusal;
  message: (typeof privacyRefusalMessage)[PrivacyRefusal];
};

const uuidSchema = z.string().refine(isUuid, "Use a valid identifier.");

const labelSchema = z.string().trim().min(1).max(120);

export const privacyActorSchema = z.strictObject({
  profileId: uuidSchema,
  organizationId: uuidSchema,
  role: z.literal("clinic_admin"),
});

export type PrivacyActor = z.infer<typeof privacyActorSchema>;

export const exportPhotoSchema = z.strictObject({
  id: uuidSchema,
  angleName: labelSchema,
  capturedAt: z.iso.datetime({ offset: true }),
  fileSizeBytes: z.number().int().nonnegative().max(500_000_000),
});

export const exportSourceSchema = z
  .strictObject({
    patientId: uuidSchema,
    organizationId: uuidSchema,
    treatmentLabels: z.array(labelSchema).max(50),
    consentPurposeNames: z.array(labelSchema).max(20),
    photos: z.array(exportPhotoSchema).max(200),
  })
  .superRefine((source, ctx) => {
    const seen = new Set<string>();
    for (const [index, photo] of source.photos.entries()) {
      if (seen.has(photo.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["photos", index, "id"],
          message: "Each photograph is listed once.",
        });
      }
      seen.add(photo.id);
    }
  });

export type ExportSource = z.infer<typeof exportSourceSchema>;

export const deletionSubjectSchema = z.strictObject({
  patientId: uuidSchema,
  organizationId: uuidSchema,
});

export type DeletionSubject = z.infer<typeof deletionSubjectSchema>;

export type ExportManifestPhoto = {
  id: string;
  angleName: string;
  capturedAt: string;
  fileSizeBytes: number;
};

export type ExportManifest = {
  patientId: string;
  treatmentLabels: string[];
  consentPurposeNames: string[];
  photos: ExportManifestPhoto[];
};

export type ExportResult =
  | { ok: true; message: typeof EXPORT_READY_MESSAGE; manifest: ExportManifest }
  | PrivacyFailure;

export type DeletionRequestRecord = {
  status: typeof DELETION_REQUEST_STATUS;
  organizationId: string;
  patientId: string;
  requestedBy: string;
};

export type DeletionResult =
  | {
      ok: true;
      message: typeof DELETION_RECORDED_MESSAGE;
      request: DeletionRequestRecord;
    }
  | PrivacyFailure;

type ForbiddenContent = "image_bytes" | "storage_path" | "signed_url" | "embedding";
type ScanHit = ForbiddenContent | "deletion_command";

const IMAGE_BYTE_KEYS = new Set([
  "imagebytes",
  "bytes",
  "imagedata",
  "base64",
  "blob",
  "buffer",
  "pixels",
  "bytearray",
  "rawbytes",
  "photobytes",
  "filebytes",
]);

const STORAGE_PATH_KEYS = new Set([
  "storagepath",
  "objectpath",
  "filepath",
  "bucketpath",
  "path",
]);

const SIGNED_URL_KEYS = new Set(["signedurl", "signedlink", "publicurl", "url"]);

const EMBEDDING_KEYS = new Set([
  "embedding",
  "embeddings",
  "vector",
  "vectors",
  "faceembedding",
]);

const DELETION_COMMAND_KEYS = new Set([
  "delete",
  "purge",
  "automatic",
  "instruction",
  "deleteinstruction",
  "deletefiles",
  "deleterows",
  "deletephotographs",
  "harddelete",
]);

/**
 * Prepares an export manifest for one patient in the caller's clinic.
 * The manifest lists identifiers and labels only. It never carries image bytes,
 * storage paths, signed URLs, or embeddings.
 */
export function prepareExportManifest(actor: unknown, source: unknown): ExportResult {
  const blocked = blockedContent(actor, source);
  if (blocked) {
    return blocked;
  }

  const tenant = sameOrganization(actor, source);
  if (tenant === "mismatch") {
    return refusal("cross_organization");
  }

  const parsedActor = privacyActorSchema.safeParse(actor);
  if (!parsedActor.success) {
    return refusal(roleDenied(actor) ? "unauthorized" : "invalid");
  }

  const parsedSource = exportSourceSchema.safeParse(source);
  if (!parsedSource.success) {
    return refusal(refusalFromIssues(parsedSource.error.issues) ?? "invalid");
  }

  if (parsedActor.data.organizationId !== parsedSource.data.organizationId) {
    return refusal("cross_organization");
  }

  return {
    ok: true,
    message: EXPORT_READY_MESSAGE,
    manifest: {
      patientId: parsedSource.data.patientId,
      treatmentLabels: parsedSource.data.treatmentLabels,
      consentPurposeNames: parsedSource.data.consentPurposeNames,
      photos: parsedSource.data.photos.map((photo) => ({
        id: photo.id,
        angleName: photo.angleName,
        capturedAt: photo.capturedAt,
        fileSizeBytes: photo.fileSizeBytes,
      })),
    },
  };
}

/**
 * Records a deletion request with status requested.
 * Photographs, rows, and files stay in place. A purge command is refused
 * because this prototype cannot delete backups.
 */
export function recordDeletionRequest(actor: unknown, subject: unknown): DeletionResult {
  const blocked = blockedContent(actor, subject);
  if (blocked) {
    return blocked;
  }

  const tenant = sameOrganization(actor, subject);
  if (tenant === "mismatch") {
    return refusal("cross_organization");
  }

  const parsedActor = privacyActorSchema.safeParse(actor);
  if (!parsedActor.success) {
    return refusal(roleDenied(actor) ? "unauthorized" : "invalid");
  }

  const parsedSubject = deletionSubjectSchema.safeParse(subject);
  if (!parsedSubject.success) {
    return refusal(refusalFromIssues(parsedSubject.error.issues) ?? "invalid");
  }

  if (parsedActor.data.organizationId !== parsedSubject.data.organizationId) {
    return refusal("cross_organization");
  }

  return {
    ok: true,
    message: DELETION_RECORDED_MESSAGE,
    request: {
      status: DELETION_REQUEST_STATUS,
      organizationId: parsedSubject.data.organizationId,
      patientId: parsedSubject.data.patientId,
      requestedBy: parsedActor.data.profileId,
    },
  };
}

/**
 * Refuses automatic deletion. Backup retention in this prototype cannot be purged,
 * so the result never includes a delete instruction.
 */
export function requestAutomaticDeletion(): PrivacyFailure {
  return refusal("backup_retention");
}

function refusal<Reason extends PrivacyRefusal>(reason: Reason): {
  ok: false;
  reason: Reason;
  message: (typeof privacyRefusalMessage)[Reason];
} {
  return {
    ok: false,
    reason,
    message: privacyRefusalMessage[reason],
  };
}

function blockedContent(actor: unknown, subject: unknown): PrivacyFailure | null {
  const hit = findProblem(subject) ?? findProblem(actor);
  if (!hit) {
    return null;
  }

  return refusal(hit === "deletion_command" ? "backup_retention" : hit);
}

function sameOrganization(actor: unknown, subject: unknown): "match" | "mismatch" | "unknown" {
  const actorOrganizationId = organizationIdOf(actor);
  const subjectOrganizationId = organizationIdOf(subject);
  if (!actorOrganizationId || !subjectOrganizationId) {
    return "unknown";
  }

  return actorOrganizationId === subjectOrganizationId ? "match" : "mismatch";
}

function organizationIdOf(value: unknown): string | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const organizationId = value.organizationId;
  return typeof organizationId === "string" && isUuid(organizationId) ? organizationId : null;
}

function roleDenied(actor: unknown): boolean {
  if (!isPlainRecord(actor) || typeof actor.role !== "string") {
    return false;
  }

  return actor.role !== "clinic_admin";
}

function refusalFromIssues(issues: readonly z.core.$ZodIssue[]): PrivacyRefusal | null {
  for (const issue of issues) {
    if (issue.code !== "unrecognized_keys" || !Array.isArray(issue.keys)) {
      continue;
    }

    for (const key of issue.keys) {
      if (typeof key !== "string") {
        continue;
      }

      const hit = classifyKey(key);
      if (hit === "deletion_command") {
        return "backup_retention";
      }
      if (hit) {
        return hit;
      }
    }

    return "invalid";
  }

  return null;
}

function findProblem(value: unknown, seen = new WeakSet<object>(), depth = 0): ScanHit | null {
  if (depth > 8 || isBinary(value)) {
    return depth > 8 ? null : "image_bytes";
  }

  if (typeof value === "string") {
    return classifyString(value);
  }

  if (typeof value !== "object" || value === null || seen.has(value)) {
    return null;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findProblem(item, seen, depth + 1);
      if (found) {
        return found;
      }
    }
    return null;
  }

  for (const [key, child] of Object.entries(value)) {
    const fromKey = classifyKey(key);
    if (fromKey) {
      return fromKey;
    }

    const found = findProblem(child, seen, depth + 1);
    if (found) {
      return found;
    }
  }

  return null;
}

function classifyKey(key: string): ScanHit | null {
  const compact = key.toLowerCase().replace(/[_-]/g, "");
  if (IMAGE_BYTE_KEYS.has(compact)) {
    return "image_bytes";
  }
  if (STORAGE_PATH_KEYS.has(compact)) {
    return "storage_path";
  }
  if (SIGNED_URL_KEYS.has(compact)) {
    return "signed_url";
  }
  if (EMBEDDING_KEYS.has(compact)) {
    return "embedding";
  }
  if (DELETION_COMMAND_KEYS.has(compact)) {
    return "deletion_command";
  }
  return null;
}

function classifyString(value: string): ForbiddenContent | null {
  const trimmed = value.trim();
  if (
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("data:application/octet-stream") ||
    looksLikeEncodedBytes(trimmed)
  ) {
    return "image_bytes";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return "signed_url";
  }

  if (isStoragePath(trimmed)) {
    return "storage_path";
  }

  if (/^\[[\d\s,.\-+eE]{16,}\]$/.test(trimmed)) {
    return "embedding";
  }

  return null;
}

function looksLikeEncodedBytes(value: string): boolean {
  return value.length >= 80 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function isStoragePath(value: string): boolean {
  if (/(?:^|[/\\])\.\.(?:[/\\]|$)/.test(value)) {
    return true;
  }

  if (/^(?:clinical-photos|photo-derivatives)\//i.test(value)) {
    return true;
  }

  return /[/\\][^/\\]+\.(?:jpe?g|png|webp|heic)$/i.test(value);
}

function isBinary(value: unknown): boolean {
  return (
    value instanceof Uint8Array ||
    value instanceof ArrayBuffer ||
    (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(value))
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !isBinary(value);
}
