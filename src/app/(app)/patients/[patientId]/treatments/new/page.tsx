import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { getAllCatalogOptions } from "@/features/catalog/queries";
import { staffChartContext } from "@/features/patients/access";
import { ChartMessage } from "@/features/patients/chart-message";
import { getPatient } from "@/features/patients/queries";
import { TreatmentForm } from "@/features/patients/treatment-form";
import { getTreatmentTemplateAction } from "@/features/treatment-templates/actions";
import {
  applyTemplate,
  templateQueryId,
  treatmentFormValuesFromDraft,
} from "@/features/treatment-templates/model";
import { isUuid } from "@/lib/ids";

export const metadata: Metadata = {
  title: "New treatment",
};

type NewTreatmentPageProps = {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{ template?: string | string[] }>;
};

const emptyTreatment = {
  name: "",
  category: "",
  bodyArea: "",
  description: "",
  startDate: "",
  status: "planned" as const,
};

export default function NewTreatmentPage({ params, searchParams }: NewTreatmentPageProps) {
  return (
    <Suspense fallback={<p className="text-base text-muted-foreground">Loading treatment…</p>}>
      <NewTreatmentContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function NewTreatmentContent({ params, searchParams }: NewTreatmentPageProps) {
  const access = await staffChartContext();

  if (!access.ok) {
    return <ChartMessage title="New treatment" message={access.message} />;
  }

  const [{ patientId }, query] = await Promise.all([params, searchParams]);
  const templateId = templateQueryId(query.template);

  if (!isUuid(patientId)) {
    return <ChartMessage title="New treatment" message="This chart is not available." />;
  }

  const [patient, catalogOptions, loaded] = await Promise.all([
    getPatient(access.organizationId, patientId),
    getAllCatalogOptions(),
    templateId ? getTreatmentTemplateAction(templateId) : Promise.resolve(null),
  ]);

  if (!patient) {
    return <ChartMessage title="New treatment" message="This chart is not available." />;
  }

  const draft =
    loaded?.status === "ready" ? applyTemplate(loaded.template, patient.id) : null;
  const templateValues = draft ? treatmentFormValuesFromDraft(draft) : null;
  const defaultValues = templateValues
    ? {
        name: templateValues.name,
        category: templateValues.category,
        bodyArea: templateValues.bodyArea,
        description: templateValues.description,
        startDate: templateValues.startDate,
        procedureType: templateValues.procedureType,
        productName: templateValues.productName,
        protocolCode: templateValues.protocolCode,
        status: templateValues.status,
      }
    : emptyTreatment;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <Link href={`/patients/${patient.id}`} className="text-base font-medium text-primary">
          {patient.firstName} {patient.lastName}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New treatment</h1>
        {templateId && loaded?.status === "ready" ? (
          <p className="mt-2 max-w-md text-base leading-7 text-muted-foreground">
            Started from {loaded.template.name}. Saving creates a new treatment and leaves
            existing treatments unchanged.
          </p>
        ) : null}
        {templateId && loaded?.status === "missing" ? (
          <p className="mt-2 max-w-md text-base leading-7 text-muted-foreground" role="status">
            That template is not available. This form starts a blank treatment.
          </p>
        ) : null}
        {templateId && loaded?.status === "error" ? (
          <p className="mt-2 max-w-md text-base text-destructive" role="alert">
            {loaded.message}
          </p>
        ) : null}
      </div>
      <TreatmentForm
        patientId={patient.id}
        defaultValues={defaultValues}
        catalogOptions={catalogOptions}
        submitLabel="Save treatment"
        pendingLabel="Saving…"
        plannedFollowUp={
          templateValues ? { days: templateValues.followUpDays } : undefined
        }
      />
    </section>
  );
}
