import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SessionPhotographs } from "@/features/capture/session-photographs";
import { buttonVariants } from "@/components/ui/button";
import { CaptureWizard } from "@/features/capture/capture-wizard";
import { ComparisonPreview } from "@/features/capture/comparison-preview";
import { getCaptureSession } from "@/features/capture/queries";
import { ChartMessage } from "@/features/patients/chart-message";
import { staffChartContext } from "@/features/patients/access";
import { isUuid } from "@/lib/ids";

export const metadata: Metadata = {
  title: "Capture session",
};

type CaptureSessionPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default function CaptureSessionPage({
  params,
}: CaptureSessionPageProps) {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">Loading capture…</p>
      }
    >
      <CaptureSessionContent params={params} />
    </Suspense>
  );
}

async function CaptureSessionContent({ params }: CaptureSessionPageProps) {
  const access = await staffChartContext();

  if (!access.ok) {
    return (
      <ChartMessage
        title="Capture session"
        message="The camera is limited to professionals in a clinic."
      />
    );
  }

  const { sessionId } = await params;
  if (!isUuid(sessionId)) {
    return (
      <ChartMessage
        title="Capture session"
        message="This session is not available."
      />
    );
  }

  const session = await getCaptureSession(access.organizationId, sessionId);
  if (!session) {
    return (
      <ChartMessage
        title="Capture session"
        message="This session is not available."
      />
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <Link href="/capture" className="text-sm font-medium text-primary">
        Guided capture
      </Link>
      {session.status === "completed" ? (
        <>
          <h1 className="text-3xl font-medium">
            {session.sessionType === "baseline" ? "Baseline" : "Follow-up"}{" "}
            photographs
          </h1>
          <p className="text-base leading-7 text-muted-foreground">
            {session.photos.length} saved photographs · {session.treatmentName}
          </p>
          <SessionPhotographs
            openPhotographs
            photos={session.photos.map((photo) => ({
              id: photo.id,
              sessionId: session.id,
              angleName:
                session.protocol.angles.find(
                  (angle) => angle.id === photo.angleId,
                )?.name ?? "Saved photograph",
            }))}
          />
          {session.patientId && session.treatmentId ? (
            <Link
              href={`/patients/${session.patientId}/treatments/${session.treatmentId}`}
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "self-start",
              })}
            >
              Back to treatment
            </Link>
          ) : null}
        </>
      ) : (
        <CaptureWizard session={session} />
      )}
      {session.status === "completed" && session.sessionType === "follow_up" ? (
        <ComparisonPreview session={session} />
      ) : null}
    </section>
  );
}
