import "server-only";

import {
  activeReleaseId,
  visibleToPatient,
  type ProgressGalleryEntry,
  type ProgressRelease,
} from "@/features/progress-gallery/model";
import {
  PROGRESS_RELEASE_COLUMNS,
  progressReleases,
  toProgressRelease,
} from "@/features/progress-gallery/table";
import { isUuid } from "@/lib/ids";
import { createClient } from "@/lib/supabase/server";

export type ProgressGallerySnapshot = {
  items: ProgressGalleryEntry[];
  releasesUnavailable: boolean;
};

type CatalogItem = {
  kind: "comparison" | "derivative";
  id: string;
  label: string;
  createdAt: string;
};

export async function listProgressGallery(
  organizationId: string,
  patientId: string,
): Promise<ProgressGallerySnapshot> {
  if (!isUuid(organizationId) || !isUuid(patientId)) {
    throw new Error("Could not load progress.");
  }

  const supabase = await createClient();
  const [comparisons, derivatives, releases] = await Promise.all([
    listComparisons(supabase, organizationId, patientId),
    listDerivatives(supabase, organizationId, patientId),
    listStoredReleases(supabase, organizationId, patientId),
  ]);

  const now = new Date();
  const releaseRows = releases.ok ? releases.releases : [];
  const items = galleryEntries([...comparisons, ...derivatives], releaseRows, now);

  return {
    items,
    releasesUnavailable: !releases.ok,
  };
}

async function listStoredReleases(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  patientId: string,
): Promise<{ ok: true; releases: ProgressRelease[] } | { ok: false }> {
  const { data, error } = await progressReleases(supabase)
    .select(PROGRESS_RELEASE_COLUMNS)
    .eq("organization_id", organizationId)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) {
    return { ok: false };
  }

  return {
    ok: true,
    releases: (data ?? []).map(toProgressRelease),
  };
}

async function listComparisons(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  patientId: string,
): Promise<CatalogItem[]> {
  const { data, error } = await supabase
    .from("comparisons")
    .select(
      "id, created_at, treatments!inner(name, patient_id, patients!inner(organization_id)), photos!comparisons_before_photo_id_fkey(photography_angles(name))",
    )
    .eq("treatments.patient_id", patientId)
    .eq("treatments.patients.organization_id", organizationId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Could not load progress.");
  }

  return (data ?? []).flatMap((row) => {
    const treatment = one(row.treatments);
    return [
      {
        kind: "comparison" as const,
        id: row.id,
        label: itemLabel("comparison", angleName(one(row.photos)), treatment?.name ?? ""),
        createdAt: row.created_at,
      },
    ];
  });
}

async function listDerivatives(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  patientId: string,
): Promise<CatalogItem[]> {
  const { data, error } = await supabase
    .from("photo_derivatives")
    .select(
      "id, created_at, photos!inner(photography_angles(name), photo_sessions!inner(treatments!inner(name, patient_id, patients!inner(organization_id))))",
    )
    .eq("photos.photo_sessions.treatments.patient_id", patientId)
    .eq("photos.photo_sessions.treatments.patients.organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Could not load progress.");
  }

  return (data ?? []).flatMap((row) => {
    const photo = one(row.photos);
    const session = photo ? one(photo.photo_sessions) : null;
    const treatment = session ? one(session.treatments) : null;
    return [
      {
        kind: "derivative" as const,
        id: row.id,
        label: itemLabel("derivative", angleName(photo), treatment?.name ?? ""),
        createdAt: row.created_at,
      },
    ];
  });
}

function galleryEntries(
  catalog: CatalogItem[],
  releases: ProgressRelease[],
  now: Date,
): ProgressGalleryEntry[] {
  const items: ProgressGalleryEntry[] = catalog.map((item) => ({
    kind: item.kind,
    id: item.id,
    label: item.label,
    createdAt: item.createdAt,
    releaseId: activeReleaseId(releases, item, now),
  }));
  const seen = new Set(items.map((item) => `${item.kind}:${item.id}`));

  for (const release of releases) {
    for (const visible of visibleToPatient([release], now)) {
      if ("comparisonId" in visible) {
        const key = `comparison:${visible.comparisonId}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        items.push({
          kind: "comparison",
          id: visible.comparisonId,
          label: "Released comparison",
          createdAt: release.createdAt,
          releaseId: release.id,
        });
        continue;
      }

      const key = `derivative:${visible.derivativeId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      items.push({
        kind: "derivative",
        id: visible.derivativeId,
        label: "Released edited photograph",
        createdAt: release.createdAt,
        releaseId: release.id,
      });
    }
  }

  return items.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function itemLabel(kind: "comparison" | "derivative", angle: string, treatment: string) {
  const subject =
    kind === "comparison" ? `${angle} comparison` : `Edited ${angle} photograph`;
  return treatment ? `${subject} · ${treatment}` : subject;
}

function angleName(photo: { photography_angles: unknown } | null) {
  const angle = photo ? one(photo.photography_angles as { name: string } | { name: string }[] | null) : null;
  const name = angle?.name.trim();
  return name ? name : "Photograph";
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}
