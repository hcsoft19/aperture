import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getWorkspace } from "@/features/access/workspace";
import { ChartMessage } from "@/features/patients/chart-message";
import { listTreatmentTemplatesAction } from "@/features/treatment-templates/actions";
import { TreatmentTemplateForm } from "@/features/treatment-templates/template-form";
import { TreatmentTemplateList } from "@/features/treatment-templates/template-list";

export const metadata = {
  title: "Treatment templates",
  robots: { index: false, follow: false },
};

export default function TreatmentTemplatesPage() {
  return (
    <Suspense
      fallback={
        <p className="text-base text-muted-foreground">Loading treatment templates…</p>
      }
    >
      <TreatmentTemplatesContent />
    </Suspense>
  );
}

async function TreatmentTemplatesContent() {
  const workspace = await getWorkspace();
  if (!workspace) {
    redirect("/login");
  }
  if (workspace.kind !== "staff" || !workspace.activeMembership) {
    return (
      <ChartMessage
        title="Treatment templates"
        message="Treatment templates are limited to clinic staff."
      />
    );
  }

  const listed = await listTreatmentTemplatesAction();
  const canEdit = workspace.activeMembership.role === "clinic_admin";

  return (
    <div className="space-y-9">
      <header>
        <p className="eyebrow mb-3 text-primary">Clinic library</p>
        <h1 className="editorial-title text-4xl sm:text-5xl">Treatment templates</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          Keep standard treatments for {workspace.activeMembership.organizationName}. A
          template starts a new draft for a patient. It does not change a treatment
          that already exists.
        </p>
      </header>
      {canEdit ? (
        <TreatmentTemplateForm />
      ) : (
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          You can review this clinic&apos;s templates. A clinic administrator can add
          or archive them.
        </p>
      )}
      {listed.status === "error" ? (
        <p className="text-base text-destructive" role="alert">
          {listed.message}
        </p>
      ) : (
        <TreatmentTemplateList templates={listed.templates} canArchive={canEdit} />
      )}
    </div>
  );
}
