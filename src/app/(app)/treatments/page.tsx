import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getWorkspace } from "@/features/access/workspace";
import { listPatientRecords } from "@/features/portal/queries";

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
          Released photographs are opened from a patient account.
        </p>
      </section>
    );
  }

  const records = await listPatientRecords(workspace.patientLinks.map((link) => link.patientId));

  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Your treatments</h1>
      <p className="text-base leading-7 text-muted-foreground">
        Only sessions and comparisons a clinic has released appear here.
      </p>
      {records.length === 0 ? (
        <p className="text-base text-muted-foreground">Nothing has been released yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {records.map((record) => (
            <li key={record.treatmentId}>
              <Link
                href={`/treatments/${record.treatmentId}`}
                className="flex min-h-11 flex-col justify-center rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10"
              >
                <span className="font-medium">{record.treatmentName}</span>
                <span className="text-sm text-muted-foreground">
                  {record.clinicName} · {record.patientName} · {record.releasedSessions} released · {record.sharedComparisons} shared
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
