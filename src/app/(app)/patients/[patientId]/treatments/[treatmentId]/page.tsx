import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { buttonVariants } from "@/components/ui/button";
import { staffChartContext } from "@/features/patients/access";
import { ChartMessage } from "@/features/patients/chart-message";
import { formatChartDate, sessionStatusLabel, sessionTypeLabel, treatmentStatusLabel } from "@/features/patients/labels";
import { countPhotographs, getPatient, getTreatment, listTreatmentSessions } from "@/features/patients/queries";
import { isUuid } from "@/lib/ids";

export const metadata: Metadata = {
  title: "Treatment",
};

type TreatmentPageProps = {
  params: Promise<{ patientId: string; treatmentId: string }>;
};

export default function TreatmentPage({ params }: TreatmentPageProps) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading treatment…</p>}>
      <TreatmentContent params={params} />
    </Suspense>
  );
}

async function TreatmentContent({ params }: TreatmentPageProps) {
  const access = await staffChartContext();

  if (!access.ok) {
    return <ChartMessage title="Treatment" message={access.message} />;
  }

  const { patientId, treatmentId } = await params;

  if (!isUuid(patientId) || !isUuid(treatmentId)) {
    return <ChartMessage title="Treatment" message="This treatment is not available." />;
  }

  const patient = await getPatient(access.organizationId, patientId);
  const treatment = patient
    ? await getTreatment(access.organizationId, patientId, treatmentId)
    : null;

  if (!patient || !treatment) {
    return <ChartMessage title="Treatment" message="This treatment is not available." />;
  }

  const [photographs, sessions] = await Promise.all([
    countPhotographs(patientId, [treatment.id]),
    listTreatmentSessions(treatment.id),
  ]);
  const startDate = formatChartDate(treatment.startDate);

  return (
    <section className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href={`/patients/${patient.id}`} className="text-sm font-medium text-primary">
            {patient.firstName} {patient.lastName}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{treatment.name}</h1>
        </div>
        <Link
          href={`/patients/${patient.id}/treatments/${treatment.id}/edit`}
          className={buttonVariants({ size: "lg", variant: "outline" })}
        >
          Edit treatment
        </Link>
      </div>
      <dl className="grid gap-3">
        <Detail label="Status" value={treatmentStatusLabel(treatment.status)} />
        <Detail label="Category" value={treatment.category} />
        <Detail label="Body area" value={treatment.bodyArea} />
        {startDate ? <Detail label="Start date" value={startDate} /> : null}
        {treatment.description ? <Detail label="Notes" value={treatment.description} /> : null}
      </dl>
      <div>
        <h2 className="text-lg font-semibold">Photographs</h2>
        <p className="mt-2 text-base leading-7 text-muted-foreground">
          {photographs === 0
            ? "No photographs yet."
            : photographs === 1
              ? "1 photograph stays with this treatment."
              : `${photographs} photographs stay with this treatment.`}
        </p>
        {sessions.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {sessions.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/capture/${session.id}`}
                  className="flex min-h-11 flex-col justify-center rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10"
                >
                  <span className="font-medium">{sessionTypeLabel(session.sessionType)}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatChartDate(session.sessionDate)} · {sessionStatusLabel(session.status)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        <Link
          href={`/capture?treatment=${treatment.id}`}
          className={`${buttonVariants({ size: "lg" })} mt-4`}
        >
          Photograph
        </Link>
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-base whitespace-pre-wrap">{value}</dd>
    </div>
  );
}
