import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { staffChartContext } from "@/features/patients/access";
import { ChartMessage } from "@/features/patients/chart-message";
import { getPatient } from "@/features/patients/queries";
import { TreatmentForm } from "@/features/patients/treatment-form";
import { isUuid } from "@/lib/ids";

export const metadata: Metadata = {
  title: "New treatment",
};

type NewTreatmentPageProps = {
  params: Promise<{ patientId: string }>;
};

const emptyTreatment = {
  name: "",
  category: "",
  bodyArea: "",
  description: "",
  startDate: "",
  status: "planned" as const,
};

export default function NewTreatmentPage({ params }: NewTreatmentPageProps) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading treatment…</p>}>
      <NewTreatmentContent params={params} />
    </Suspense>
  );
}

async function NewTreatmentContent({ params }: NewTreatmentPageProps) {
  const access = await staffChartContext();

  if (!access.ok) {
    return <ChartMessage title="New treatment" message={access.message} />;
  }

  const { patientId } = await params;

  if (!isUuid(patientId)) {
    return <ChartMessage title="New treatment" message="This chart is not available." />;
  }

  const patient = await getPatient(access.organizationId, patientId);

  if (!patient) {
    return <ChartMessage title="New treatment" message="This chart is not available." />;
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <Link href={`/patients/${patient.id}`} className="text-sm font-medium text-primary">
          {patient.firstName} {patient.lastName}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New treatment</h1>
      </div>
      <TreatmentForm
        patientId={patient.id}
        defaultValues={emptyTreatment}
        submitLabel="Save treatment"
        pendingLabel="Saving…"
      />
    </section>
  );
}
