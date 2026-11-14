import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { progressGalleryMount } from "@/features/progress-gallery/mount";
import { ProgressGallery } from "@/features/progress-gallery/progress-gallery";
import { listProgressGallery } from "@/features/progress-gallery/queries";
import { staffChartContext } from "@/features/patients/access";
import { ChartMessage } from "@/features/patients/chart-message";
import { getPatient } from "@/features/patients/queries";
import { isUuid } from "@/lib/ids";

export const metadata: Metadata = {
  title: progressGalleryMount.label,
};

type ProgressPageProps = {
  params: Promise<{ patientId: string }>;
};

export default function PatientProgressPage({ params }: ProgressPageProps) {
  return (
    <Suspense fallback={<p className="text-base text-muted-foreground">Loading progress…</p>}>
      <PatientProgressContent params={params} />
    </Suspense>
  );
}

async function PatientProgressContent({ params }: ProgressPageProps) {
  const access = await staffChartContext();

  if (!access.ok) {
    return <ChartMessage title={progressGalleryMount.label} message={access.message} />;
  }

  const { patientId } = await params;

  if (!isUuid(patientId)) {
    return <ChartMessage title={progressGalleryMount.label} message="This chart is not available." />;
  }

  let patient;
  let snapshot;
  try {
    [patient, snapshot] = await Promise.all([
      getPatient(access.organizationId, patientId),
      listProgressGallery(access.organizationId, patientId),
    ]);
  } catch {
    return <ChartMessage title={progressGalleryMount.label} message="Progress could not be loaded." />;
  }

  if (!patient) {
    return <ChartMessage title={progressGalleryMount.label} message="This chart is not available." />;
  }

  return (
    <section className="flex max-w-2xl flex-col gap-6" aria-labelledby="progress-heading">
      <div>
        <Link
          href={`/patients/${patient.id}`}
          className="inline-flex min-h-11 items-center text-base font-medium text-primary"
        >
          {patient.firstName} {patient.lastName}
        </Link>
        <h1 id="progress-heading" className="mt-2 text-2xl font-semibold tracking-tight">
          {progressGalleryMount.label}
        </h1>
        <p className="mt-2 text-base leading-7 text-muted-foreground">
          Release a comparison or an edited photograph to the patient. Revoke it to hide it again.
          Original photographs stay in the clinic record.
        </p>
      </div>
      <ProgressGallery
        patientId={patient.id}
        items={snapshot.items}
        releasesUnavailable={snapshot.releasesUnavailable}
      />
    </section>
  );
}
