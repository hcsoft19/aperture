import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { staffChartContext } from "@/features/patients/access";
import { ChartMessage } from "@/features/patients/chart-message";
import { getPatient, getTreatment } from "@/features/patients/queries";
import { TreatmentForm } from "@/features/patients/treatment-form";
import { isUuid } from "@/lib/ids";

export const metadata: Metadata = {
  title: "Edit treatment",
};

type EditTreatmentPageProps = {
  params: Promise<{ patientId: string; treatmentId: string }>;
};

export default function EditTreatmentPage({ params }: EditTreatmentPageProps) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading treatment…</p>}>
      <EditTreatmentContent params={params} />
    </Suspense>
  );
}

async function EditTreatmentContent({ params }: EditTreatmentPageProps) {
  const access = await staffChartContext();

  if (!access.ok) {
    return <ChartMessage title="Edit treatment" message={access.message} />;
  }

  const { patientId, treatmentId } = await params;

  if (!isUuid(patientId) || !isUuid(treatmentId)) {
    return <ChartMessage title="Edit treatment" message="This treatment is not available." />;
  }

  const patient = await getPatient(access.organizationId, patientId);
  const treatment = patient
    ? await getTreatment(access.organizationId, patientId, treatmentId)
    : null;

  if (!patient || !treatment) {
    return <ChartMessage title="Edit treatment" message="This treatment is not available." />;
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <Link
          href={`/patients/${patient.id}/treatments/${treatment.id}`}
          className="text-sm font-medium text-primary"
        >
          {treatment.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit treatment</h1>
      </div>
      <TreatmentForm
        patientId={patient.id}
        treatmentId={treatment.id}
        defaultValues={{
          name: treatment.name,
          category: treatment.category,
          procedureType: treatment.procedureType,
          productName: treatment.productName,
          protocolCode: treatment.protocolCode as import("@/features/patients/schemas").TreatmentValues["protocolCode"],
          bodyArea: treatment.bodyArea,
          description: treatment.description ?? "",
          startDate: treatment.startDate ?? "",
          status: treatment.status,
        }}
        submitLabel="Save treatment"
        pendingLabel="Saving…"
      />
    </section>
  );
}
