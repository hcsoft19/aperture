import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { getWorkspace } from "@/features/access/workspace";
import { CreateClinicForm } from "@/features/organizations/create-clinic-form";

export const metadata: Metadata = {
  title: "Home",
};

const upcoming = [
  {
    title: "Patients",
    description: "Search and update charts for this clinic. Other clinics stay hidden.",
  },
  {
    title: "Guided capture",
    description: "The camera follows the facial protocol stored for the clinic.",
  },
  {
    title: "Comparisons",
    description: "Original photographs stay private. Side-by-side review is not open yet.",
  },
];

export default function WorkspaceHomePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading home…</p>}>
      <WorkspaceHome />
    </Suspense>
  );
}

async function WorkspaceHome() {
  const workspace = await getWorkspace();

  if (!workspace) {
    redirect("/login");
  }

  if (workspace.kind === "needs_clinic") {
    return (
      <section className="flex max-w-prose flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Create your clinic</h1>
          <p className="mt-2 text-base leading-7 text-muted-foreground">
            This account is not part of a clinic yet. The clinic you create is separate from every other clinic.
          </p>
        </div>
        <CreateClinicForm />
      </section>
    );
  }

  if (workspace.kind === "patient") {
    return (
      <section className="flex max-w-prose flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Your records</h1>
        <p className="text-base leading-7 text-muted-foreground">
          You can see clinics that have linked this account. Photographs appear here only after a professional releases them.
        </p>
        <ul className="flex flex-col gap-3">
          {workspace.patientLinks.map((link) => (
            <li key={link.patientId} className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <p className="font-medium">{link.organizationName}</p>
              <p className="text-sm text-muted-foreground">
                {link.firstName} {link.lastName}
              </p>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {workspace.activeMembership?.organizationName}
        </h1>
        <p className="mt-2 max-w-prose text-base leading-7 text-muted-foreground">
          You are signed in as{" "}
          {workspace.activeMembership?.role === "clinic_admin"
            ? "a clinic administrator."
            : "a professional."}{" "}
          Patient charts and guided capture are open. Comparisons are not.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {upcoming.map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <h2 className="text-base font-medium">{item.title}</h2>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
