import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { staffChartContext } from "@/features/patients/access";
import { ChartMessage } from "@/features/patients/chart-message";
import { PatientForm } from "@/features/patients/patient-form";

export const metadata: Metadata = {
  title: "New chart",
};

const emptyPatient = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  contactEmail: "",
  phone: "",
};

export default function NewPatientPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading chart…</p>}>
      <NewPatientContent />
    </Suspense>
  );
}

async function NewPatientContent() {
  const access = await staffChartContext();

  if (!access.ok) {
    return <ChartMessage title="New chart" message={access.message} />;
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <Link href="/patients" className="text-sm font-medium text-primary">
          Patients
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New chart</h1>
        <p className="mt-2 text-base leading-7 text-muted-foreground">
          {`This chart stays inside ${access.clinicName}.`}
        </p>
      </div>
      <PatientForm
        defaultValues={emptyPatient}
        submitLabel="Save chart"
        pendingLabel="Saving…"
      />
    </section>
  );
}
