import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { createClient as supabaseClient } from "@supabase/supabase-js";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { slugSchema } from "./models";
// Public reads deliberately ignore the browser's session, including administrator sessions.
export function createPublicClient() {
  const env = readSupabaseEnv();
  if (!env) throw new Error("Public clinic unavailable.");
  return supabaseClient<Database>(env.url, env.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
export const getPublicClinic = cache(async (slug: string) => {
  await connection();
  if (!slugSchema.safeParse(slug).success) return null;
  const db = createPublicClient();
  const { data, error } = await db
    .from("clinic_profiles")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (error) throw new Error("Clinic unavailable.");
  return data;
});
export async function getClinicRedirect(slug: string) {
  if (!slugSchema.safeParse(slug).success) return null;
  const db = createPublicClient();
  const { data } = await db
    .from("clinic_slug_reservations")
    .select("organization_id")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const { data: profile } = await db
    .from("clinic_profiles")
    .select("slug")
    .eq("organization_id", data.organization_id)
    .eq("published", true)
    .maybeSingle();
  return profile?.slug ?? null;
}
export async function getStaffClinicProfile(org: string) {
  const db = await createClient();
  const { data, error } = await db
    .from("clinic_profiles")
    .select("*")
    .eq("organization_id", org)
    .maybeSingle();
  if (error) throw new Error("Clinic profile unavailable.");
  return data;
}
export async function listPublicResults(org: string, category = "", page = 1) {
  const db = createPublicClient();
  const size = 12;
  let query = db
    .from("clinic_showcase_results")
    .select("*", { count: "exact" })
    .eq("organization_id", org)
    .eq("published", true)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (category) query = query.eq("category", category);
  const { data, error, count } = await query.range(
    (page - 1) * size,
    page * size - 1,
  );
  if (error) throw new Error("Results unavailable.");
  return { items: data ?? [], total: count ?? 0, page, size };
}
export async function getPublicResult(org: string, slug: string) {
  const db = createPublicClient();
  const { data, error } = await db
    .from("clinic_showcase_results")
    .select("*")
    .eq("organization_id", org)
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (error) throw new Error("Result unavailable.");
  return data;
}
export async function listStaffPublications(org: string) {
  const db = await createClient();
  const { data, error } = await db
    .from("clinic_showcase_results")
    .select("*,clinic_publication_permissions(revoked_at)")
    .eq("organization_id", org)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Published results unavailable.");
  return (data ?? []).map((row) => {
    const permission = Array.isArray(row.clinic_publication_permissions)
      ? row.clinic_publication_permissions[0]
      : row.clinic_publication_permissions;
    return { ...row, revoked: !permission || Boolean(permission.revoked_at) };
  });
}
export async function listPublicationSources(org: string) {
  const db = await createClient();
  const { data, error } = await db
    .from("clinic_gallery_entries")
    .select("id,treatment_name,category,procedure_type,body_area")
    .eq("organization_id", org)
    .eq("entry_kind", "clinical")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error("Comparisons unavailable.");
  return (data ?? []).flatMap((x) =>
    x.id
      ? [
          {
            id: x.id,
            title: x.treatment_name ?? "Comparison",
            category: x.category ?? "",
            procedure: x.procedure_type ?? "",
            bodyArea: x.body_area ?? "",
          },
        ]
      : [],
  );
}
export async function listPublicationAudit(org: string) {
  const db = await createClient();
  const { data, error } = await db
    .from("audit_events")
    .select("id,action,created_at,profiles(full_name)")
    .eq("organization_id", org)
    .in("action", [
      "clinic_profile_saved",
      "showcase_published",
      "showcase_unpublished",
    ])
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) return [];
  return (data ?? []).map((event) => ({
    ...event,
    actor:
      (Array.isArray(event.profiles) ? event.profiles[0] : event.profiles)
        ?.full_name ?? "Clinic administrator",
  }));
}
