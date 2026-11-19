import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { buttonVariants } from "@/components/ui/button";
import { staffChartContext } from "@/features/patients/access";
import { ChartMessage } from "@/features/patients/chart-message";
import { formatChartDate, treatmentStatusLabel } from "@/features/patients/labels";
import { countPhotographs, getPatient, listPatientPhotographs, listTreatments } from "@/features/patients/queries";
import { InvitePanel } from "@/features/sharing/invite-panel";
import { getChartLink } from "@/features/sharing/queries";
import { isUuid } from "@/lib/ids";

export const metadata: Metadata = {
  title: "Chart",
};

type ChartPageProps = {
  params: Promise<{ patientId: string }>;
};

export default function PatientChartPage({ params }: ChartPageProps) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading chart…</p>}>
      <PatientChartContent params={params} />
    </Suspense>
  );
}

async function PatientChartContent({ params }: ChartPageProps) {
  const access = await staffChartContext();

  if (!access.ok) {
    return <ChartMessage title="Chart" message={access.message} />;
  }

  const { patientId } = await params;

  if (!isUuid(patientId)) {
    return <ChartMessage title="Chart" message="This chart is not available." />;
  }

  const patient = await getPatient(access.organizationId, patientId);

  if (!patient) {
    return <ChartMessage title="Chart" message="This chart is not available." />;
  }

  const [treatments, link, photographsOnChart] = await Promise.all([
    listTreatments(patientId),
    getChartLink(patientId),
    listPatientPhotographs(access.organizationId, patientId),
  ]);
  const photographs = await countPhotographs(
    patientId,
    treatments.map((treatment) => treatment.id),
  );
  const details = [
    ["Date of birth", formatChartDate(patient.dateOfBirth)],
    ["Contact email", patient.contactEmail],
    ["Phone", patient.phone],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <section className="flex max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/patients" className="text-sm font-medium text-primary">
            Patients
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {patient.firstName} {patient.lastName}
          </h1>
        </div>
        <Link href={`/patients/${patient.id}/edit`} className={buttonVariants({ size: "lg", variant: "outline" })}>
          Edit chart
        </Link>
      </div>
      {photographsOnChart.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Photographs</h2>
          <LatestPhotograph patientId={patient.id} photo={photographsOnChart[0]} />
          {photographsOnChart.length > 1 ? (
            <ul aria-label="More photographs" className="flex gap-3 overflow-x-auto pb-1">
              {photographsOnChart.slice(1).map((photo) => (
                <li key={photo.id} className="w-24 shrink-0">
                  <Link href={`/patients/${patient.id}/photos/${photo.id}/edit?from=${encodeURIComponent(`/patients/${patient.id}`)}`} className="block">
                    <span className="relative block aspect-[3/4] overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10">
                      <Image src={`/api/clinic-photos/${photo.id}`} alt={photo.angleName} fill unoptimized sizes="96px" className="object-contain" />
                    </span>
                    <span className="mt-1 block text-sm font-medium">{photo.angleName}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <nav aria-label="Chart sections" className="flex flex-wrap gap-3">
        <Link href={`/patients/${patient.id}/timeline`} className={buttonVariants({ size: "lg", variant: "outline" })}>Timeline</Link>
        <Link href={`/patients/${patient.id}/progress`} className={buttonVariants({ size: "lg", variant: "outline" })}>Progress</Link>
        <Link href={`/patients/${patient.id}/consent`} className={buttonVariants({ size: "lg", variant: "outline" })}>Consent</Link>
        <Link href={`/patients/${patient.id}/privacy`} className={buttonVariants({ size: "lg", variant: "outline" })}>Privacy</Link>
      </nav>
      {details.length > 0 ? (
        <dl className="grid gap-3">
          {details.map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="text-base">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Treatments</h2>
          <Link
            href={`/patients/${patient.id}/treatments/new`}
            className={buttonVariants({ size: "lg" })}
          >
            Add treatment
          </Link>
        </div>
        {treatments.length === 0 ? (
          <p className="text-base leading-7 text-muted-foreground">No treatments yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {treatments.map((treatment) => (
              <li key={treatment.id}>
                <Link
                  href={`/patients/${patient.id}/treatments/${treatment.id}`}
                  className="flex min-h-11 flex-col justify-center rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10"
                >
                  <span className="font-medium">{treatment.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {treatmentStatusLabel(treatment.status)} · {treatment.bodyArea}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h2 className="text-lg font-semibold">Patient account</h2>
        <div className="mt-3">
          <InvitePanel patientId={patient.id} linked={link.linked} invitation={link.invitation} />
        </div>
      </div>
      {photographsOnChart.length === 0 ? (
        <div>
          <h2 className="text-lg font-semibold">Photographs</h2>
          <p className="mt-2 text-base leading-7 text-muted-foreground">
            {photographs === 0
              ? "No photographs yet. Open a treatment to start a session."
              : "Photographs stay in the clinic record. Open a treatment to review them."}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function LatestPhotograph({
  patientId,
  photo,
}: {
  patientId: string;
  photo: { id: string; angleName: string };
}) {
  const href = `/patients/${patientId}/photos/${photo.id}/edit?from=${encodeURIComponent(`/patients/${patientId}`)}`;
  return (
    <div className="flex flex-col gap-3">
      <Link href={href} className="relative block aspect-[3/4] max-h-[58dvh] overflow-hidden rounded-2xl bg-muted ring-2 ring-primary">
        <Image src={`/api/clinic-photos/${photo.id}`} alt={photo.angleName} fill unoptimized sizes="(min-width: 1024px) 640px, 100vw" className="object-contain" />
        <span className="absolute top-3 left-3 rounded-full bg-card/95 px-3 py-1 text-sm font-medium text-primary">Uploaded photograph</span>
      </Link>
      <Link href={href} className={buttonVariants({ size: "lg", className: "mb-2 w-full scroll-mb-28" })}>
        Edit {photo.angleName}
      </Link>
    </div>
  );
}
