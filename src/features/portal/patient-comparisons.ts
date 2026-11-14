import { visibleToPatient, type ProgressRelease } from "@/features/progress-gallery/model";

export type PortalComparisonCandidate = {
  id: string;
  treatmentId: string;
  sharedWithPatient: boolean;
  revokedAt: string | null;
};

export function releasedComparisonIds(
  releases: readonly ProgressRelease[],
  now: Date,
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const visible of visibleToPatient(releases, now)) {
    if (!("comparisonId" in visible) || seen.has(visible.comparisonId)) {
      continue;
    }
    seen.add(visible.comparisonId);
    ids.push(visible.comparisonId);
  }

  return ids;
}

export function portalComparisonVisible(
  comparison: {
    id: string;
    sharedWithPatient: boolean;
    revokedAt: string | null;
  },
  releasedIds: ReadonlySet<string>,
): boolean {
  const shared = comparison.sharedWithPatient && comparison.revokedAt === null;
  return shared || releasedIds.has(comparison.id);
}

export function visibleComparisonIdsForTreatment(
  treatmentId: string,
  comparisons: readonly PortalComparisonCandidate[],
  releases: readonly ProgressRelease[],
  now: Date,
): string[] {
  const releasedIds = new Set(releasedComparisonIds(releases, now));
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const comparison of comparisons) {
    if (comparison.treatmentId !== treatmentId || seen.has(comparison.id)) {
      continue;
    }
    if (!portalComparisonVisible(comparison, releasedIds)) {
      continue;
    }
    seen.add(comparison.id);
    ids.push(comparison.id);
  }

  return ids;
}
