import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { createPublicClient } from "@/features/clinic-showcase/queries";
import { siteOrigin } from "@/features/clinic-showcase/site-url";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const origin = siteOrigin();
  const db = createPublicClient();
  const { data: clinics } = await db
    .from("clinic_profiles")
    .select("organization_id,slug,updated_at")
    .eq("published", true)
    .eq("allow_indexing", true)
    .limit(1000);
  const rows: MetadataRoute.Sitemap = [{ url: origin }];
  for (const clinic of clinics ?? []) {
    rows.push({
      url: `${origin}/clinics/${clinic.slug}`,
      lastModified: clinic.updated_at,
    });
    const { data: results } = await db
      .from("clinic_showcase_results")
      .select("slug,updated_at")
      .eq("organization_id", clinic.organization_id)
      .eq("published", true)
      .limit(1000);
    for (const result of results ?? [])
      rows.push({
        url: `${origin}/clinics/${clinic.slug}/results/${result.slug}`,
        lastModified: result.updated_at,
      });
  }
  return rows;
}
