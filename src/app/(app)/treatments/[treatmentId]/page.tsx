import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getWorkspace } from "@/features/access/workspace";
import { ChartMessage } from "@/features/patients/chart-message";
import { formatChartDate } from "@/features/patients/labels";
import { ReleasedComparisonView } from "@/features/portal/released-comparison";
import { getReleasedTreatment } from "@/features/portal/queries";
import { isUuid } from "@/lib/ids";

export const metadata: Metadata = {
  title: "Released treatment",
};

type ReleasedTreatmentPageProps = {
  params: Promise<{ treatmentId: string }>;
};

export default function ReleasedTreatmentPage({ params }: ReleasedTreatmentPageProps) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading treatment…</p>}>
      <ReleasedTreatmentContent params={params} />
    </Suspense>
  );
}

async function ReleasedTreatmentContent({ params }: ReleasedTreatmentPageProps) {
  const workspace = await getWorkspace();
  if (!workspace) {
    redirect("/login");
  }

  if (workspace.kind !== "patient") {
    return <ChartMessage title="Treatment" message="Released photographs are opened from a patient account." />;
  }

  const { treatmentId } = await params;
  if (!isUuid(treatmentId)) {
    return <ChartMessage title="Treatment" message="This treatment is not available." />;
  }

  const treatment = await getReleasedTreatment(treatmentId);
  if (!treatment || (treatment.sessions.length === 0 && treatment.comparisons.length === 0)) {
    return <ChartMessage title="Treatment" message="This treatment is not available." />;
  }

  return (
    <section className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link href="/treatments" className="text-sm font-medium text-primary">Your treatments</Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{treatment.name}</h1>
        <p className="mt-2 text-base text-muted-foreground">{treatment.clinicName}</p>
      </div>
      {treatment.sessions.map((session) => (
        <div key={session.id} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{session.label}</h2>
          <p className="text-sm text-muted-foreground">{formatChartDate(session.date)}</p>
          <ul className="grid grid-cols-2 gap-3">
            {session.photos.map((photo) => (
              <li key={photo.id}>
                {photo.previewUrl ? (
                  <Image src={photo.previewUrl} alt={photo.label} width={600} height={800} unoptimized className="aspect-[3/4] w-full rounded-lg bg-muted object-contain" />
                ) : null}
                <p className="mt-2 text-sm">{photo.label}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {treatment.comparisons.length > 0 ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Comparisons</h2>
          {treatment.comparisons.map((comparison) => (
            <ReleasedComparisonView key={comparison.id} comparison={comparison} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
