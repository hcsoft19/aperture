import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { SessionPhotographs } from "@/features/capture/session-photographs";
import { Suspense } from "react";

import { buttonVariants } from "@/components/ui/button";
import { staffChartContext } from "@/features/patients/access";
import { ChartMessage } from "@/features/patients/chart-message";
import {
  formatChartDate,
  sessionStatusLabel,
  sessionTypeLabel,
  treatmentStatusLabel,
} from "@/features/patients/labels";
import {
  countPhotographs,
  getPatient,
  getTreatment,
  listTreatmentSessions,
  listTreatmentPhotographs,
} from "@/features/patients/queries";
import { ReleaseButton, ShareButton } from "@/features/sharing/share-controls";
import { listTreatmentComparisons } from "@/features/sharing/queries";
import { isUuid } from "@/lib/ids";

export const metadata: Metadata = {
  title: "Treatment",
};

type TreatmentPageProps = {
  params: Promise<{ patientId: string; treatmentId: string }>;
};

export default function TreatmentPage({ params }: TreatmentPageProps) {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">Loading treatment…</p>
      }
    >
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
    return (
      <ChartMessage
        title="Treatment"
        message="This treatment is not available."
      />
    );
  }

  const patient = await getPatient(access.organizationId, patientId);
  const treatment = patient
    ? await getTreatment(access.organizationId, patientId, treatmentId)
    : null;

  if (!patient || !treatment) {
    return (
      <ChartMessage
        title="Treatment"
        message="This treatment is not available."
      />
    );
  }

  const [photographs, sessions, comparisons, savedPhotos] = await Promise.all([
    countPhotographs(patientId, [treatment.id]),
    listTreatmentSessions(treatment.id),
    listTreatmentComparisons(treatment.id),
    listTreatmentPhotographs(access.organizationId, treatment.id),
  ]);
  const followUpDraft = sessions.find(
    (session) =>
      session.sessionType === "follow_up" && session.status === "draft",
  );
  const hasBaseline = sessions.some(
    (session) =>
      session.sessionType === "baseline" && session.status === "completed",
  );
  const startDate = formatChartDate(treatment.startDate);

  return (
    <section className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href={`/patients/${patient.id}`}
            className="text-sm font-medium text-primary"
          >
            {patient.firstName} {patient.lastName}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {treatment.name}
          </h1>
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
        <Detail
          label="Procedure / type"
          value={treatment.procedureType || "Not recorded"}
        />
        <Detail
          label="Product / drug"
          value={treatment.productName || "Not recorded"}
        />
        <Detail
          label="Photography protocol"
          value={treatment.protocolCode.replaceAll("_", " ")}
        />
        <Detail label="Body area" value={treatment.bodyArea} />
        {startDate ? <Detail label="Start date" value={startDate} /> : null}
        {treatment.description ? (
          <Detail label="Notes" value={treatment.description} />
        ) : null}
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
                <div className="flex flex-col gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10">
                  <Link
                    href={`/capture/${session.id}`}
                    className="flex min-h-11 flex-col justify-center"
                  >
                    <span className="font-medium">
                      {sessionTypeLabel(session.sessionType)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {formatChartDate(session.sessionDate)} ·{" "}
                      {sessionStatusLabel(session.status)}
                      {session.status === "completed"
                        ? ` · ${session.releasedToPatient ? "Released" : "Not released"}`
                        : ""}
                    </span>
                  </Link>
                  <SessionPhotographs
                    photos={savedPhotos.filter(
                      (photo) => photo.sessionId === session.id,
                    )}
                  />
                  <Link
                    href={`/capture/${session.id}`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "lg",
                    })}
                  >
                    {session.status === "draft"
                      ? "Resume session"
                      : "View session photographs"}
                  </Link>
                  {session.status === "completed" ? (
                    <ReleaseButton
                      sessionId={session.id}
                      released={session.releasedToPatient}
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <Link
          href={
            followUpDraft
              ? `/capture/${followUpDraft.id}`
              : `/capture?treatment=${treatment.id}`
          }
          className={`${buttonVariants({ size: "lg" })} mt-4`}
        >
          {followUpDraft
            ? "Resume follow-up"
            : hasBaseline
              ? "Take follow-up photographs"
              : "Photograph"}
        </Link>
      </div>
      <div>
        <h2 className="text-lg font-semibold">Comparisons</h2>
        {comparisons.length === 0 ? (
          <p className="mt-2 text-base text-muted-foreground">
            {sessions.some(
              (session) =>
                session.sessionType === "follow_up" &&
                session.status === "completed",
            )
              ? "Open a completed follow-up to review and save matching comparisons."
              : "Your baseline photographs are saved above. Complete a follow-up session to create before-and-after comparisons. Releasing a session controls patient access; clinic staff can view saved photographs immediately."}
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {comparisons.map((comparison) => (
              <li
                key={comparison.id}
                className="flex flex-col gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10"
              >
                <Link
                  href={`/results/${comparison.id}`}
                  className="font-medium text-primary underline underline-offset-4"
                >
                  {comparison.angleName} · Open comparison
                </Link>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: comparison.beforeId, label: "Before" },
                    { id: comparison.afterId, label: "After" },
                  ].map((photo) => (
                    <Link key={photo.id} href={`/results/${comparison.id}`}>
                      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted">
                        <Image
                          src={`/api/clinic-photos/${photo.id}`}
                          alt={`${photo.label}: ${comparison.angleName}`}
                          fill
                          unoptimized
                          sizes="300px"
                          className="object-contain"
                        />
                      </div>
                      <span className="mt-2 block text-sm">{photo.label}</span>
                    </Link>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  {comparison.aligned ? "Aligned" : "Not aligned"} ·{" "}
                  {comparison.shared ? "Shared" : "Not shared"}
                </p>
                <ShareButton
                  comparisonId={comparison.id}
                  shared={comparison.shared}
                />
              </li>
            ))}
          </ul>
        )}
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
