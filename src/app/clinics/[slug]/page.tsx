import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import {
  getPublicClinic,
  getClinicRedirect,
  listPublicResults,
  createPublicClient,
} from "@/features/clinic-showcase/queries";
import { ClinicPublicView } from "@/features/clinic-showcase/public-view";
import {
  clinicMetadata,
  clinicStructuredData,
  jsonLd,
} from "@/features/clinic-showcase/seo";
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; category?: string }>;
};
export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicClinic(slug);
  if (!profile)
    return {
      title: "Clinic unavailable",
      robots: { index: false, follow: false },
    };
  const q = await searchParams;
  return clinicMetadata(
    profile,
    undefined,
    Number(q.page) || 1,
    Boolean(q.category),
  );
}
export default function ClinicPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-5 py-16 text-base text-muted-foreground">
          Opening the clinic…
        </div>
      }
    >
      <Content {...props} />
    </Suspense>
  );
}
async function Content({ params, searchParams }: Props) {
  const { slug } = await params;
  const profile = await getPublicClinic(slug);
  if (!profile) {
    const redirect = await getClinicRedirect(slug);
    if (redirect && redirect !== slug)
      permanentRedirect(`/clinics/${redirect}`);
    notFound();
  }
  const q = await searchParams;
  const page = q.page ? Number(q.page) : 1;
  if (!Number.isInteger(page) || page < 1 || page > 10000) notFound();
  const category =
    typeof q.category === "string" ? q.category.slice(0, 80) : "";
  const [results, facets] = await Promise.all([
    listPublicResults(profile.organization_id, category, page),
    createPublicClient()
      .from("clinic_showcase_results")
      .select("category")
      .eq("organization_id", profile.organization_id)
      .eq("published", true)
      .limit(1000),
  ]);
  if (page > 1 && !results.items.length) notFound();
  const categories = [
    ...new Set((facets.data ?? []).map((x) => x.category)),
  ].sort();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(clinicStructuredData(profile)),
        }}
      />
      <ClinicPublicView
        profile={profile}
        results={results.items}
        total={results.total}
        page={page}
        categories={categories}
        category={category}
      />
    </>
  );
}
