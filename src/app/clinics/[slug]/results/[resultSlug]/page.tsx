import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import {
  getPublicClinic,
  getPublicResult,
  getClinicRedirect,
} from "@/features/clinic-showcase/queries";
import { PublicResultView } from "@/features/clinic-showcase/public-view";
import { clinicMetadata } from "@/features/clinic-showcase/seo";
type Props = { params: Promise<{ slug: string; resultSlug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params;
  const profile = await getPublicClinic(p.slug);
  const result = profile
    ? await getPublicResult(profile.organization_id, p.resultSlug)
    : null;
  return profile && result
    ? clinicMetadata(profile, result)
    : { title: "Result unavailable", robots: { index: false, follow: false } };
}
export default function ResultPage(props: Props) {
  return (
    <Suspense fallback={<p className="p-8 text-base">Opening the result…</p>}>
      <Content {...props} />
    </Suspense>
  );
}
async function Content({ params }: Props) {
  const p = await params;
  const profile = await getPublicClinic(p.slug);
  if (!profile) {
    const next = await getClinicRedirect(p.slug);
    if (next && next !== p.slug)
      permanentRedirect(
        `/clinics/${next}/results/${encodeURIComponent(p.resultSlug)}`,
      );
    notFound();
  }
  const result = await getPublicResult(profile.organization_id, p.resultSlug);
  if (!result) notFound();
  return <PublicResultView profile={profile} result={result} />;
}
