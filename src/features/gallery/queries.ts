import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { patientSearchTerm } from "@/features/patients/search";
import {
  galleryAlignment,
  sourceCredits,
  emptyGalleryFacets,
  GALLERY_PAGE_SIZE,
  type GalleryFacets,
  type GalleryPage,
  type GalleryPageInput,
  type GalleryResult,
} from "./models";
import type { Database } from "@/types/database";

export async function listClinicResults(
  organizationId: string,
  input: GalleryPageInput,
): Promise<GalleryPage> {
  const supabase = await createClient();
  const ascending = input.sort === "oldest";
  let query = supabase
    .from("clinic_gallery_entries")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("created_at", { ascending })
    .order("id", { ascending });
  const search = patientSearchTerm(input.search);
  if (search)
    query = query.or(
      `treatment_name.ilike."%${search}%",patient_name.ilike."%${search}%"`,
    );
  if (input.visibility === "shared") query = query.eq("shared", true);
  if (input.visibility === "private") query = query.eq("shared", false);
  if (input.category) query = query.eq("category", input.category);
  if (input.procedure) query = query.eq("procedure_type", input.procedure);
  if (input.product) query = query.eq("product_name", input.product);
  if (input.bodyArea) query = query.eq("body_area", input.bodyArea);
  if (input.gender) query = query.eq("patient_gender", input.gender);
  if (input.collection !== "all")
    query = query.eq("entry_kind", input.collection);
  if (input.uploadedFrom)
    query = query.gte("uploaded_at", `${input.uploadedFrom}T00:00:00Z`);
  if (input.uploadedTo)
    query = query.lte("uploaded_at", `${input.uploadedTo}T23:59:59.999999Z`);
  if (input.cursor) {
    const direction = ascending ? "gt" : "lt";
    query = query.or(
      `created_at.${direction}.${input.cursor.createdAt},and(created_at.eq.${input.cursor.createdAt},id.${direction}.${input.cursor.id})`,
    );
  }
  const { data, error, count } = await query.limit(GALLERY_PAGE_SIZE + 1);
  if (error) throw new Error("Could not load the clinic gallery.");
  const rows = data ?? [];
  const page = rows.slice(0, GALLERY_PAGE_SIZE);
  const last = page.at(-1);
  return {
    items: await presentRows(supabase, page),
    total: count ?? 0,
    nextCursor:
      rows.length > GALLERY_PAGE_SIZE && last?.created_at && last.id
        ? { createdAt: last.created_at, id: last.id }
        : null,
  };
}
export async function getClinicResult(
  organizationId: string,
  resultId: string,
): Promise<GalleryResult | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinic_gallery_entries")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", resultId)
    .maybeSingle();
  if (error) throw new Error("Could not load this result.");
  return data ? ((await presentRows(supabase, [data]))[0] ?? null) : null;
}
export async function getGalleryFacets(
  organizationId: string,
): Promise<GalleryFacets> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("clinic_gallery_facets", {
    target_org: organizationId,
  });
  if (error) throw new Error("Could not load gallery filters.");
  const parsed = z
    .object({
      categories: z.array(z.string()),
      procedures: z.array(z.string()),
      products: z.array(z.string()),
      bodyAreas: z.array(z.string()),
    })
    .safeParse(data);
  if (!parsed.success) return emptyGalleryFacets;
  return Object.fromEntries(
    Object.entries(parsed.data).map(([key, values]) => [
      key,
      values.sort((a, b) => a.localeCompare(b)),
    ]),
  ) as GalleryFacets;
}

type Row = Database["public"]["Views"]["clinic_gallery_entries"]["Row"];
async function presentRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: Row[],
): Promise<GalleryResult[]> {
  const paths = [
    ...new Set(
      rows
        .flatMap((row) => [row.before_path, row.after_path])
        .filter((path): path is string => Boolean(path)),
    ),
  ];
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage
      .from("clinical-photos")
      .createSignedUrls(paths, 900);
    for (const item of data ?? [])
      if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return rows.flatMap((row) =>
    row.id && row.created_at && row.before_path
      ? [
          {
            id: row.id,
            createdAt: row.created_at,
            entryKind: row.entry_kind === "demo" ? "demo" : "clinical",
            isPlate: row.is_plate ?? false,
            sourceCredits: sourceCredits(row.source_credits),
            patientId: row.patient_id,
            patientName: row.patient_name ?? "Reference example",
            patientGender: row.patient_gender,
            treatmentId: row.treatment_id,
            treatmentName: row.treatment_name ?? "Result",
            bodyArea: row.body_area ?? "",
            category: row.category ?? "",
            procedure: row.procedure_type ?? "",
            product: row.product_name ?? "",
            notes: row.notes,
            uploadedAt: row.uploaded_at,
            shared: row.shared ?? false,
            angleName: row.angle_name ?? "Photograph",
            alignment: galleryAlignment(row.alignment),
            before: {
              photoId: row.before_photo_id,
              url: urls.get(row.before_path) ?? null,
              sessionId: row.before_session_id,
              date: row.before_date ?? row.created_at,
              width: row.before_width,
              height: row.before_height,
            },
            after: {
              photoId: row.after_photo_id,
              url: row.after_path ? (urls.get(row.after_path) ?? null) : null,
              sessionId: row.after_session_id,
              date: row.after_date ?? row.created_at,
              width: row.after_width,
              height: row.after_height,
            },
          },
        ]
      : [],
  );
}
