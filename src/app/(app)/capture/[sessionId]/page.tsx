import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

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

export default function CaptureSessionPage({ params }: CaptureSessionPageProps) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading capture…</p>}>
      <CaptureSessionContent params={params} />
    </Suspense>
  );
}

async function CaptureSessionContent({ params }: CaptureSessionPageProps) {
  const access = await staffChartContext();

  if (!access.ok) {
    return <ChartMessage title="Capture session" message="The camera is limited to professionals in a clinic." />;
  }

  const { sessionId } = await params;
  if (!isUuid(sessionId)) {
    return <ChartMessage title="Capture session" message="This session is not available." />;
  }

  const session = await getCaptureSession(access.organizationId, sessionId);
  if (!session) {
    return <ChartMessage title="Capture session" message="This session is not available." />;
  }

  return (
    <section className="flex flex-col gap-4">
      <Link href="/capture" className="text-sm font-medium text-primary">
        Guided capture
      </Link>
      <CaptureWizard session={session} />
      {session.status === "completed" && session.sessionType === "follow_up" ? <ComparisonPreview session={session} /> : null}
    </section>
  );
}
