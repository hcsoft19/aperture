import { z } from "zod";

import { isUuid } from "@/lib/ids";

export const EMPTY_PROGRESS_MESSAGE =
  "No comparisons or edited photographs are ready to release.";

const DERIVATIVE_STORAGE_PATH =
  /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png)$/i;

export type ReleaseCandidate = {
  kind: "comparison" | "derivative" | "original";
  id: string;
  storagePath?: string | null;
};

export type ProgressRelease = {
  id: string;
  organizationId: string;
  patientId: string;
  comparisonId: string | null;
  /** Original photograph. This column is not a patient release. */
  photoId: string | null;
  /** Edited photograph stored in progress_releases.derivative_id. */
  derivativeId: string | null;
  releasedBy: string;
  revokedAt: string | null;
  createdAt: string;
  storagePath?: string | null;
};

export type PatientVisibleRelease =
  | { comparisonId: string }
  | { derivativeId: string };

export type ProgressGalleryEntry = {
  kind: "comparison" | "derivative";
  id: string;
  label: string;
  createdAt: string;
  releaseId: string | null;
};

export type ProgressActionResult =
  | { status: "error"; message: string }
  | { status: "success"; message: string };

export const releaseRequestSchema = z
  .object({
    patientId: z.string().refine(isUuid, "This chart is not available."),
    comparisonId: z.string().optional().default(""),
    derivativeId: z.string().optional().default(""),
  })
  .refine((value) => exactlyOneTarget(value.comparisonId, value.derivativeId), {
    message: "Choose one comparison or one edited photograph.",
  });

export const revokeRequestSchema = z.object({
  patientId: z.string().refine(isUuid, "This chart is not available."),
  releaseId: z.string().refine(isUuid, "This release is not available."),
});

export function canRelease(item: ReleaseCandidate): boolean {
  if (item.kind !== "comparison" && item.kind !== "derivative") {
    return false;
  }

  if (!isUuid(item.id)) {
    return false;
  }

  const path = typeof item.storagePath === "string" ? item.storagePath.trim() : "";
  if (path.length > 0 && isOriginalClinicalPath(path)) {
    return false;
  }

  if (item.kind === "comparison") {
    return path.length === 0;
  }

  return path.length === 0 || DERIVATIVE_STORAGE_PATH.test(path);
}

export function revoke(release: ProgressRelease, now: Date): ProgressRelease {
  const revokedAt = Number.isNaN(now.getTime()) ? release.revokedAt : now.toISOString();

  return {
    id: release.id,
    organizationId: release.organizationId,
    patientId: release.patientId,
    comparisonId: release.comparisonId,
    photoId: release.photoId,
    derivativeId: release.derivativeId,
    releasedBy: release.releasedBy,
    createdAt: release.createdAt,
    revokedAt,
    ...(release.storagePath !== undefined ? { storagePath: release.storagePath } : {}),
  };
}

export function visibleToPatient(
  releases: readonly (Partial<ProgressRelease> | null | undefined)[],
  now: Date,
): PatientVisibleRelease[] {
  if (Number.isNaN(now.getTime())) {
    return [];
  }

  const visible: PatientVisibleRelease[] = [];

  for (const release of releases) {
    const view = patientView(release, now);
    if (view) {
      visible.push(view);
    }
  }

  return visible;
}

export function activeReleaseId(
  releases: readonly ProgressRelease[],
  target: { kind: "comparison" | "derivative"; id: string },
  now: Date,
): string | null {
  for (const release of releases) {
    const visible = visibleToPatient([release], now);
    const matches = visible.some((item) =>
      target.kind === "comparison"
        ? "comparisonId" in item && item.comparisonId === target.id
        : "derivativeId" in item && item.derivativeId === target.id,
    );
    if (matches) {
      return release.id;
    }
  }

  return null;
}

function patientView(
  release: Partial<ProgressRelease> | null | undefined,
  now: Date,
): PatientVisibleRelease | null {
  if (!release?.id || !isUuid(release.id) || isRevoked(release.revokedAt, now)) {
    return null;
  }

  const comparisonId = uuidOrNull(release.comparisonId);
  const derivativeId = uuidOrNull(release.derivativeId);
  const photoId = uuidOrNull(release.photoId);
  const targetCount = [comparisonId, derivativeId, photoId].filter(Boolean).length;
  if (targetCount !== 1) {
    return null;
  }

  if (comparisonId) {
    return { comparisonId };
  }

  if (derivativeId) {
    return { derivativeId };
  }

  return null;
}

function uuidOrNull(value: unknown) {
  return typeof value === "string" && isUuid(value) ? value : null;
}

function isRevoked(revokedAt: string | null | undefined, now: Date) {
  if (revokedAt == null || revokedAt === "") {
    return false;
  }

  const revoked = Date.parse(revokedAt);
  if (Number.isNaN(revoked)) {
    return true;
  }

  return revoked <= now.getTime();
}

function isOriginalClinicalPath(path: string) {
  const normalized = path.trim().replace(/^\/+/, "");
  if (normalized.length === 0) {
    return false;
  }

  if (normalized.includes("clinical-photos")) {
    return true;
  }

  return normalized.split("/").filter(Boolean).length >= 5;
}

function exactlyOneTarget(comparisonId: string, derivativeId: string) {
  const comparison = comparisonId.trim();
  const derivative = derivativeId.trim();
  const comparisonReady = isUuid(comparison) && derivative.length === 0;
  const derivativeReady = isUuid(derivative) && comparison.length === 0;
  return comparisonReady || derivativeReady;
}
