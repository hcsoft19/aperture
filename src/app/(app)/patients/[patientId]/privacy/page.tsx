import Link from "next/link";
import { Suspense } from "react";

import { getWorkspace } from "@/features/access/workspace";
import { staffChartContext } from "@/features/patients/access";
import { ChartMessage } from "@/features/patients/chart-message";
import { getPatient } from "@/features/patients/queries";
import { DeletionRequestForm } from "@/features/production-readiness/deletion-request-form";
import { isUuid } from "@/lib/ids";

export const metadata = {
  title: "Privacy request",
  robots: { index: false, follow: false },
};

type PrivacyPageProps = {
  params: Promise<{ patientId: string }>;
};

export default function PrivacyRequestPage({ params }: PrivacyPageProps) {
  return (
    <Suspense fallback={<p className="text-base">Loading privacy request…</p>}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: PrivacyPageProps) {
  const access = await staffChartContext();
  if (!access.ok) {
    return <ChartMessage title="Privacy request" message={access.message} />;
  }

  const { patientId } = await params;
  if (!isUuid(patientId)) {
    return <ChartMessage title="Privacy request" message="This chart is not available." />;
  }

  const patient = await getPatient(access.organizationId, patientId);
  if (!patient) {
    return <ChartMessage title="Privacy request" message="This chart is not available." />;
  }

  const workspace = await getWorkspace();
  const isAdmin = workspace?.kind === "staff" && workspace.activeMembership?.role === "clinic_admin";

  return (
    <section className="flex max-w-xl flex-col gap-4">
      <Link href={`/patients/${patient.id}`} className="text-base font-medium text-primary">
        Chart
      </Link>
      <h1 className="text-3xl">Privacy request</h1>
      <p className="text-base">
        {patient.firstName} {patient.lastName}
      </p>
      {isAdmin ? (
        <DeletionRequestForm patientId={patient.id} />
      ) : (
        <p className="text-base">Only a clinic administrator can make this request.</p>
      )}
    </section>
  );
}
