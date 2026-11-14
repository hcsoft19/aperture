import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getWorkspace } from "@/features/access/workspace";
import { ChartMessage } from "@/features/patients/chart-message";
import { listWorkQueue } from "@/features/work-queue/queries";
import type { QueueView } from "@/features/work-queue/queue";
import { WorkQueueList } from "@/features/work-queue/work-queue-list";

export const metadata: Metadata = {
  title: "Work queue",
  robots: { index: false, follow: false },
};

export default function ClinicQueuePage() {
  return (
    <Suspense
      fallback={
        <p className="text-base text-muted-foreground">Loading the work queue…</p>
      }
    >
      <ClinicQueueContent />
    </Suspense>
  );
}

async function ClinicQueueContent() {
  const workspace = await getWorkspace();

  if (!workspace) {
    redirect("/login");
  }

  if (workspace.kind !== "staff" || !workspace.activeMembership) {
    return (
      <ChartMessage
        title="Work queue"
        message="The work queue is limited to clinic staff."
      />
    );
  }

  const queue = await loadQueue(workspace.activeMembership.organizationId);

  if (!queue) {
    return (
      <ChartMessage
        title="Work queue"
        message="The work queue could not be loaded. Please try again."
      />
    );
  }

  return (
    <section className="flex max-w-2xl flex-col gap-8">
      <header className="rounded-2xl bg-secondary px-5 py-6">
        <p className="text-base font-medium text-primary">
          {workspace.activeMembership.organizationName}
        </p>
        <h1 className="editorial-title mt-2 text-4xl">Work queue</h1>
        <p className="mt-3 max-w-prose text-base leading-7 text-foreground">
          Finish drafts, record photography consent, and revisit sessions that
          were just completed.
        </p>
      </header>
      <WorkQueueList view={queue} />
    </section>
  );
}

async function loadQueue(organizationId: string): Promise<QueueView | null> {
  try {
    return await listWorkQueue(organizationId);
  } catch {
    return null;
  }
}
