import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { staffChartContext } from "@/features/patients/access";
import { ChartMessage } from "@/features/patients/chart-message";
import { PatientForm } from "@/features/patients/patient-form";
import { getPatient } from "@/features/patients/queries";
import { isUuid } from "@/lib/ids";

export const metadata: Metadata = {
  title: "Edit chart",
};

type EditChartPageProps = {
  params: Promise<{ patientId: string }>;
};

export default function EditChartPage({ params }: EditChartPageProps) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading chart…</p>}>
      <EditChartContent params={params} />
    </Suspense>
  );
}

async function EditChartContent({ params }: EditChartPageProps) {
  const access = await staffChartContext();

  if (!access.ok) {
    return <ChartMessage title="Edit chart" message={access.message} />;
  }

  const { patientId } = await params;

  if (!isUuid(patientId)) {
    return <ChartMessage title="Edit chart" message="This chart is not available." />;
  }

  const patient = await getPatient(access.organizationId, patientId);

  if (!patient) {
    return <ChartMessage title="Edit chart" message="This chart is not available." />;
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <Link href={`/patients/${patient.id}`} className="text-sm font-medium text-primary">
          {patient.firstName} {patient.lastName}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit chart</h1>
      </div>
      <PatientForm
        patientId={patient.id}
        defaultValues={{
          firstName: patient.firstName,
          lastName: patient.lastName,
          dateOfBirth: patient.dateOfBirth ?? "",
          contactEmail: patient.contactEmail ?? "",
          phone: patient.phone ?? "",
          gender: (patient.gender ?? "") as import("@/features/patients/schemas").PatientValues["gender"],
        }}
        submitLabel="Save chart"
        pendingLabel="Saving…"
      />
    </section>
  );
}
