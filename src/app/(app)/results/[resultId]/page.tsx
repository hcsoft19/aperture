import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { z } from "zod";
import { staffChartContext } from "@/features/patients/access";
import { ChartMessage } from "@/features/patients/chart-message";
import { getClinicResult } from "@/features/gallery/queries";
import { ResultView } from "@/features/gallery/result-view";

export const metadata: Metadata = { title: "Clinic result" };
export default function ResultPage({
  params,
}: {
  params: Promise<{ resultId: string }>;
}) {
  return (
    <Suspense fallback={<p role="status">Loading clinic result…</p>}>
      <ResultContent params={params} />
    </Suspense>
  );
}
async function ResultContent({
  params,
}: {
  params: Promise<{ resultId: string }>;
}) {
  const access = await staffChartContext();
  if (!access.ok)
    return <ChartMessage title="Clinic result" message={access.message} />;
  const { resultId } = await params;
  if (!z.string().uuid().safeParse(resultId).success)
    return (
      <ChartMessage
        title="Clinic result"
        message="This result is not available."
      />
    );
  let result;
  try {
    result = await getClinicResult(access.organizationId, resultId);
  } catch {
    return (
      <ChartMessage
        title="Clinic result"
        message="This result could not be loaded. Please try again."
      />
    );
  }
  if (!result)
    return (
      <ChartMessage
        title="Clinic result"
        message="This result is not available."
      />
    );
  return (
    <section>
      <Link
        href="/home"
        className="mb-5 inline-flex min-h-11 items-center text-base font-medium text-primary hover:underline"
      >
        ← Back to clinic gallery
      </Link>
      <p className="eyebrow mb-3 text-primary">{access.clinicName}</p>
      <h1 className="mb-7 text-3xl font-medium tracking-tight sm:text-4xl">
        {result.treatmentName}
      </h1>
      <ResultView result={result} />
    </section>
  );
}
