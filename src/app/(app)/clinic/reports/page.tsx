import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getWorkspace } from "@/features/access/workspace";
import { ReportPreview } from "@/features/clinic-reports/report-preview";
import { buildReport, reportRefusalMessage, sampleReportInput } from "@/features/clinic-reports/report";
import { ChartMessage } from "@/features/patients/chart-message";

export const metadata: Metadata = {
  title: "Clinic reports",
  robots: { index: false, follow: false },
};

export default function ClinicReportsPage() {
  return (
    <Suspense fallback={<p className="text-base text-muted-foreground">Loading clinic reports…</p>}>
      <ClinicReports />
    </Suspense>
  );
}

async function ClinicReports() {
  const workspace = await getWorkspace();

  if (!workspace) {
    redirect("/login");
  }

  if (workspace.kind !== "staff" || !workspace.activeMembership) {
    return (
      <ChartMessage title="Clinic reports" message="Clinic reports are limited to clinic staff." />
    );
  }

  const preview = buildReport(sampleReportInput);
  if (!preview.ok) {
    return <ChartMessage title="Clinic reports" message={reportRefusalMessage[preview.reason]} />;
  }

  return (
    <div className="space-y-9">
      <header>
        <p className="eyebrow mb-3 text-primary">Approved comparisons</p>
        <h1 className="editorial-title text-4xl sm:text-5xl">Clinic reports</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          This report uses approved comparisons only. A revoked comparison is refused. Marketing use also
          requires marketing consent. {workspace.activeMembership.organizationName} is named on the report,
          with the angle label and the treatment date. An original photograph path is never included.
        </p>
      </header>
      <ReportPreview report={preview.report} />
    </div>
  );
}
