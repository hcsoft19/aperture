import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { staffChartContext } from "@/features/patients/access";
import { ChartMessage } from "@/features/patients/chart-message";
import { listPatients } from "@/features/patients/queries";

export const metadata: Metadata = {
  title: "Patients",
};

type PatientsPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default function PatientsPage({ searchParams }: PatientsPageProps) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading patients…</p>}>
      <PatientsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PatientsContent({ searchParams }: PatientsPageProps) {
  const access = await staffChartContext();

  if (!access.ok) {
    return <ChartMessage title="Patients" message={access.message} />;
  }

  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const patients = await listPatients(access.organizationId, query);

  return (
    <section className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Patients</h1>
          <p className="mt-2 text-base leading-7 text-muted-foreground">{access.clinicName}</p>
        </div>
        <Link href="/patients/new" className={buttonVariants({ size: "lg" })}>
          New chart
        </Link>
      </div>
      <form action="/patients" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="patient-search">Search by name</Label>
          <Input id="patient-search" name="q" defaultValue={query} />
        </div>
        <ButtonSubmit />
      </form>
      {patients.length === 0 ? (
        <p className="text-base leading-7 text-muted-foreground">
          {query.trim() ? "No charts match that search." : "No charts yet."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {patients.map((patient) => (
            <li key={patient.id}>
              <Link
                href={`/patients/${patient.id}`}
                className="flex min-h-11 flex-col justify-center rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10"
              >
                <span className="font-medium">
                  {patient.firstName} {patient.lastName}
                </span>
                {patient.contactEmail ? (
                  <span className="text-sm text-muted-foreground">{patient.contactEmail}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ButtonSubmit() {
  return (
    <button
      type="submit"
      className={buttonVariants({ size: "lg", variant: "outline" })}
    >
      Search
    </button>
  );
}
