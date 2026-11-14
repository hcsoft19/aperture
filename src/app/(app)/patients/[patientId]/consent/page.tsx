import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { staffChartContext } from "@/features/patients/access";
import { ChartMessage } from "@/features/patients/chart-message";
import { getPatient } from "@/features/patients/queries";
import { ConsentPanel } from "@/features/purpose-consent/consent-panel";
import { consentMount } from "@/features/purpose-consent/mount";
import { listPurposeConsents } from "@/features/purpose-consent/queries";
import { consentSummaries } from "@/features/purpose-consent/rules";
import { isUuid } from "@/lib/ids";

export const metadata: Metadata = {
  title: consentMount.label,
};

type ConsentPageProps = {
  params: Promise<{ patientId: string }>;
};

export default function PatientConsentPage({ params }: ConsentPageProps) {
  return (
    <Suspense
      fallback={
        <p className="text-base text-muted-foreground">Loading consent…</p>
      }
    >
      <PatientConsentContent params={params} />
    </Suspense>
  );
}

async function PatientConsentContent({ params }: ConsentPageProps) {
  const access = await staffChartContext();

  if (!access.ok) {
    return <ChartMessage title="Consent" message={access.message} />;
  }

  const { patientId } = await params;

  if (!isUuid(patientId)) {
    return (
      <ChartMessage title="Consent" message="This chart is not available." />
    );
  }

  const patient = await getPatient(access.organizationId, patientId);

  if (!patient) {
    return (
      <ChartMessage title="Consent" message="This chart is not available." />
    );
  }

  let records;
  try {
    records = await listPurposeConsents(access.organizationId, patient.id);
  } catch {
    return (
      <ChartMessage title="Consent" message="Consent could not be loaded." />
    );
  }

  const summaries = consentSummaries(records, new Date());

  return (
    <section
      className="flex max-w-2xl flex-col gap-6"
      aria-labelledby="purpose-consent-heading"
    >
      <div>
        <Link
          href={`/patients/${patient.id}`}
          className="text-base font-medium text-primary"
        >
          {patient.firstName} {patient.lastName}
        </Link>
        <h1
          id="purpose-consent-heading"
          className="mt-2 text-2xl font-semibold tracking-tight"
        >
          {consentMount.label}
        </h1>
        <p className="mt-2 text-base leading-7 text-muted-foreground">
          Each purpose is recorded separately. Clinical photography does not
          include patient portal sharing or marketing publication.
        </p>
      </div>
      <ConsentPanel patientId={patient.id} summaries={summaries} />
    </section>
  );
}
