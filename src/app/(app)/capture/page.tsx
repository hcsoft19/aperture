import type { Metadata } from "next";
import { Suspense } from "react";

import { staffChartContext } from "@/features/patients/access";
import { ChartMessage } from "@/features/patients/chart-message";
import { CaptureSetup } from "@/features/capture/capture-setup";
import { getCaptureProtocol, listCaptureTargets } from "@/features/capture/queries";

export const metadata: Metadata = {
  title: "Capture",
};

type CapturePageProps = {
  searchParams: Promise<{ treatment?: string | string[] }>;
};

export default function CapturePage({ searchParams }: CapturePageProps) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading capture…</p>}>
      <CaptureContent searchParams={searchParams} />
    </Suspense>
  );
}

async function CaptureContent({ searchParams }: CapturePageProps) {
  const access = await staffChartContext();

  if (!access.ok) {
    return (
      <ChartMessage
        title="Guided capture"
        message={
          access.message === "Create a clinic before opening patient charts."
            ? "Create a clinic before using the camera."
            : "The camera is limited to professionals in a clinic."
        }
      />
    );
  }

  const [targets, protocol, params] = await Promise.all([
    listCaptureTargets(access.organizationId),
    getCaptureProtocol(),
    searchParams,
  ]);
  const treatment = typeof params.treatment === "string" ? params.treatment : undefined;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Guided capture</h1>
        <p className="mt-2 max-w-prose text-base leading-7 text-muted-foreground">
          {protocol
            ? `${protocol.name}, version ${protocol.version}, has ${protocol.angles.length} angles. The camera loads those instructions from the clinic record.`
            : "The photography protocol is not available."}
        </p>
      </div>
      <CaptureSetup targets={targets} initialTreatmentId={treatment} />
    </section>
  );
}
