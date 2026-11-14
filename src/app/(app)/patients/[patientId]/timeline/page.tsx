import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getWorkspace } from "@/features/access/workspace";
import { loadPatientTimeline } from "@/features/patient-timeline/load";
import { timelineMount } from "@/features/patient-timeline/mount";
import { PatientTimeline } from "@/features/patient-timeline/patient-timeline";
import { staffChartContext } from "@/features/patients/access";
import { ChartMessage } from "@/features/patients/chart-message";
import { getPatient } from "@/features/patients/queries";
import { isUuid } from "@/lib/ids";

export const metadata: Metadata = {
  title: timelineMount.label,
  robots: { index: false, follow: false },
};

type TimelinePageProps = {
  params: Promise<{ patientId: string }>;
};

export default function PatientTimelinePage({ params }: TimelinePageProps) {
  return (
    <Suspense fallback={<p className="text-base text-muted-foreground">Loading timeline…</p>}>
      <PatientTimelineContent params={params} />
    </Suspense>
  );
}

async function PatientTimelineContent({ params }: TimelinePageProps) {
  const { patientId } = await params;

  if (!isUuid(patientId)) {
    return <ChartMessage title={timelineMount.label} message="This chart is not available." />;
  }

  const workspace = await getWorkspace();

  if (!workspace) {
    redirect("/login");
  }

  if (workspace.kind === "patient") {
    const link = workspace.patientLinks.find((item) => item.patientId === patientId);

    if (!link) {
      return <ChartMessage title={timelineMount.label} message="This chart is not available." />;
    }

    const patient = await getPatient(link.organizationId, patientId);

    if (!patient) {
      return <ChartMessage title={timelineMount.label} message="This chart is not available." />;
    }

    const timeline = await loadPatientTimeline(link.organizationId, patientId, "patient");

    return (
      <section className="flex max-w-2xl flex-col gap-6" aria-labelledby="patient-timeline-heading">
        <div>
          <Link
            href="/treatments"
            className="inline-flex min-h-11 items-center text-base font-medium text-primary"
          >
            Your treatments
          </Link>
          <h1 id="patient-timeline-heading" className="mt-2 text-2xl font-semibold tracking-tight">
            {patient.firstName} {patient.lastName}
          </h1>
          <p className="mt-2 text-base leading-7 text-muted-foreground">
            Released visits from {link.organizationName}.
          </p>
        </div>
        <PatientTimeline timeline={timeline} />
      </section>
    );
  }

  const access = await staffChartContext();

  if (!access.ok) {
    return <ChartMessage title={timelineMount.label} message={access.message} />;
  }

  const patient = await getPatient(access.organizationId, patientId);

  if (!patient) {
    return <ChartMessage title={timelineMount.label} message="This chart is not available." />;
  }

  const timeline = await loadPatientTimeline(access.organizationId, patientId, "staff");

  return (
    <section className="flex max-w-2xl flex-col gap-6" aria-labelledby="patient-timeline-heading">
      <div>
        <Link
          href={`/patients/${patient.id}`}
          className="inline-flex min-h-11 items-center text-base font-medium text-primary"
        >
          {patient.firstName} {patient.lastName}
        </Link>
        <h1 id="patient-timeline-heading" className="mt-2 text-2xl font-semibold tracking-tight">
          {timelineMount.label}
        </h1>
        <p className="mt-2 text-base leading-7 text-muted-foreground">{access.clinicName}</p>
      </div>
      <PatientTimeline timeline={timeline} />
    </section>
  );
}
