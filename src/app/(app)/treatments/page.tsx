import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getWorkspace } from "@/features/access/workspace";

export const metadata: Metadata = {
  title: "Treatments",
};

export default function TreatmentsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading treatments…</p>}>
      <TreatmentsContent />
    </Suspense>
  );
}

async function TreatmentsContent() {
  const workspace = await getWorkspace();

  if (!workspace) {
    redirect("/login");
  }

  if (workspace.kind !== "patient") {
    return (
      <section className="max-w-prose">
        <h1 className="text-2xl font-semibold tracking-tight">Treatments</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          This page is the patient view of released treatment history.
        </p>
      </section>
    );
  }

  return (
    <section className="max-w-prose">
      <p className="text-sm font-medium text-primary">Phase 6</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Treatments</h1>
      <p className="mt-3 text-base leading-7 text-muted-foreground">
        Released sessions and comparisons will be listed here. Clinical notes and unreleased photographs stay with the clinic.
      </p>
    </section>
  );
}
