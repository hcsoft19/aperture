import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProgressRelease } from "@/features/progress-gallery/model";
import type { Database } from "@/types/database";

export const PROGRESS_RELEASE_COLUMNS =
  "id, organization_id, patient_id, comparison_id, photo_id, derivative_id, released_by, revoked_at, created_at" as const;

export type ProgressReleaseRow = {
  id: string;
  organization_id: string;
  patient_id: string;
  comparison_id: string | null;
  photo_id: string | null;
  derivative_id: string | null;
  released_by: string;
  revoked_at: string | null;
  created_at: string;
};

type ReleaseInsert = {
  organization_id: string;
  patient_id: string;
  comparison_id: string | null;
  photo_id: null;
  derivative_id: string | null;
  released_by: string;
};

type ReleaseResult<T> = {
  data: T;
  error: { message: string } | null;
};

type ReleaseRead = {
  eq: (
    column: "id" | "organization_id" | "patient_id" | "comparison_id" | "photo_id" | "derivative_id",
    value: string,
  ) => ReleaseRead;
  order: (
    column: "created_at",
    options: { ascending: boolean },
  ) => Promise<ReleaseResult<ProgressReleaseRow[] | null>>;
  maybeSingle: () => Promise<ReleaseResult<ProgressReleaseRow | null>>;
};

type ReleaseInsertBuilder = {
  select: (columns: "id") => Promise<ReleaseResult<Array<{ id: string }> | null>>;
};

type ReleaseUpdate = {
  eq: (column: "id" | "organization_id" | "patient_id", value: string) => ReleaseUpdate;
  is: (column: "revoked_at", value: null) => ReleaseUpdate;
  select: (columns: "id") => Promise<ReleaseResult<Array<{ id: string }> | null>>;
};

type ReleaseTable = {
  select: (columns: typeof PROGRESS_RELEASE_COLUMNS) => ReleaseRead;
  insert: (row: ReleaseInsert) => ReleaseInsertBuilder;
  update: (row: { revoked_at: string }) => ReleaseUpdate;
};

/**
 * Queries stay on the signed-in client so row security still applies.
 */
export function progressReleases(supabase: SupabaseClient<Database>) {
  const from = supabase.from.bind(supabase) as unknown as (
    table: "progress_releases",
  ) => ReleaseTable;
  return from("progress_releases");
}

export function toProgressRelease(row: ProgressReleaseRow): ProgressRelease {
  return {
    id: row.id,
    organizationId: row.organization_id,
    patientId: row.patient_id,
    comparisonId: row.comparison_id,
    photoId: row.photo_id,
    derivativeId: row.derivative_id,
    releasedBy: row.released_by,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}
