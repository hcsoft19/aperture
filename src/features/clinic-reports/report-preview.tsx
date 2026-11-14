import { formatReportDate, type ClinicReport } from "@/features/clinic-reports/report";

export function ReportPreview({ report }: { report: ClinicReport }) {
  return (
    <article className="rounded-xl border border-border bg-secondary p-5" aria-labelledby="disclosure-preview">
      <h2 id="disclosure-preview" className="text-xl font-medium tracking-tight">
        Disclosure preview
      </h2>
      <p className="mt-2 text-base leading-7 text-muted-foreground">
        This sample is not a patient result. When a presentation edit was applied, the report includes the disclosure below.
      </p>
      <dl className="mt-5 grid gap-4">
        <div>
          <dt className="text-base font-medium">Clinic</dt>
          <dd className="text-base leading-7 text-muted-foreground">{report.clinicName}</dd>
        </div>
        <div>
          <dt className="text-base font-medium">Angle</dt>
          <dd className="text-base leading-7 text-muted-foreground">{report.angleLabel}</dd>
        </div>
        <div>
          <dt className="text-base font-medium">Treatment date</dt>
          <dd className="text-base leading-7 text-muted-foreground">{formatReportDate(report.treatmentDate)}</dd>
        </div>
        {report.disclosure ? (
          <div>
            <dt className="text-base font-medium">Disclosure</dt>
            <dd className="mt-2 inline-flex min-h-11 items-center rounded-lg bg-background px-4 text-base font-medium text-foreground">
              {report.disclosure}
            </dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}
