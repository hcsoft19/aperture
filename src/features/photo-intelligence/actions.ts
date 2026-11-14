"use server";

import { z } from "zod";

import { getWorkspace } from "@/features/access/workspace";
import { recommend } from "@/features/photo-intelligence/recommendations/recommend";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

const suggestionSchema = z.object({
  kind: z.enum(["framing", "alignment", "segmentation", "recommendation"]),
  status: z.enum(["accepted", "rejected"]),
  heuristicVersion: z.string().trim().min(1).max(40),
  modelId: z.string().trim().min(1).max(80).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  photoId: z.uuid(),
  payload: z.record(z.string().max(40), z.union([z.string().max(160), z.number(), z.boolean(), z.null()])).refine(
    (payload) => Object.keys(payload).length <= 12,
    "The suggestion is too large.",
  ),
});

const setupSchema = z.object({
  status: z.enum(["good", "warning", "poor", "unavailable"]),
  warnings: z.array(z.string().max(40)).max(12),
});

export async function setupSuggestionsAction(input: z.infer<typeof setupSchema>) {
  const parsed = setupSchema.safeParse(input);
  const workspace = await getWorkspace();
  if (!parsed.success || workspace?.kind !== "staff") {
    return { available: false as const };
  }
  return recommend(parsed.data);
}

export async function recordSuggestionAction(input: z.infer<typeof suggestionSchema>) {
  const parsed = suggestionSchema.safeParse(input);
  const workspace = await getWorkspace();
  if (!parsed.success || !workspace?.activeMembership || workspace.kind !== "staff") {
    return { ok: false as const, message: "The suggestion could not be saved." };
  }

  const supabase = await createClient();
  const { data: photo, error } = await supabase
    .from("photos")
    .select("id, photo_sessions!inner(treatments!inner(patients!inner(organization_id)))")
    .eq("id", parsed.data.photoId)
    .eq(
      "photo_sessions.treatments.patients.organization_id",
      workspace.activeMembership.organizationId,
    )
    .maybeSingle();
  if (error || !photo) {
    return { ok: false as const, message: "The suggestion could not be saved." };
  }

  const inserted = await suggestionTable(supabase as SupabaseClient<Database>).insert({
    organization_id: workspace.activeMembership.organizationId,
    photo_id: photo.id,
    comparison_id: null,
    kind: parsed.data.kind,
    heuristic_version: parsed.data.heuristicVersion,
    model_id: parsed.data.modelId,
    status: parsed.data.status,
    confidence: parsed.data.confidence,
    payload: parsed.data.payload,
    created_by: workspace.user.id,
  });
  return inserted.error
    ? { ok: false as const, message: "The suggestion could not be saved." }
    : { ok: true as const, message: "Suggestion recorded." };
}

type SuggestionInsert = {
  organization_id: string;
  photo_id: string | null;
  comparison_id: string | null;
  kind: string;
  heuristic_version: string;
  model_id: string | null;
  status: string;
  confidence: number | null;
  payload: Record<string, string | number | boolean | null>;
  created_by: string;
};

function suggestionTable(supabase: SupabaseClient<Database>) {
  const from = supabase.from.bind(supabase) as unknown as (table: "photo_suggestions") => {
    insert: (row: SuggestionInsert) => Promise<{ error: { message: string } | null }>;
  };
  return from("photo_suggestions");
}
