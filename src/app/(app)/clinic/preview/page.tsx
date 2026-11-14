import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getWorkspace } from "@/features/access/workspace";
import {
  getStaffClinicProfile,
  listStaffPublications,
} from "@/features/clinic-showcase/queries";
import {
  ClinicPublicView,
  PublicResultView,
} from "@/features/clinic-showcase/public-view";
export const metadata = {
  title: "Private clinic preview",
  robots: { index: false, follow: false },
};
export default function Preview({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  return (
    <Suspense fallback={<p>Loading preview…</p>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
async function Content({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const w = await getWorkspace();
  if (w?.kind !== "staff" || w.activeMembership?.role !== "clinic_admin")
    redirect("/clinic");
  const [profile, results, params] = await Promise.all([
    getStaffClinicProfile(w.activeMembership.organizationId),
    listStaffPublications(w.activeMembership.organizationId),
    searchParams,
  ]);
  if (!profile) redirect("/clinic");
  const available = results.filter((result) => !result.revoked);
  const selected = available.find((x) => x.id === params.result);
  return selected ? (
    <>
      <p className="rounded-xl bg-secondary p-4 text-base text-primary">
        Private result preview · not publicly accessible unless published
      </p>
      <PublicResultView profile={profile} result={selected} preview />
    </>
  ) : (
    <ClinicPublicView profile={profile} results={available} preview />
  );
}
