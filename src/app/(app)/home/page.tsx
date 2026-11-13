import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import Link from "next/link";
import { ArrowRight, Camera, Users, UserPlus, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getWorkspace } from "@/features/access/workspace";
import { CreateClinicForm } from "@/features/organizations/create-clinic-form";

export const metadata: Metadata = {
  title: "Home",
};

const quickActions = [
  { title: "Patient library", description: "Find a chart, revisit a session, and pick up where you left off.", href: "/patients", label: "View patients", icon: Users },
  { title: "Guided capture", description: "Bring consistency to each session with step-by-step photographic views.", href: "/capture", label: "Start a session", icon: Camera },
  { title: "A new patient story", description: "Create a patient chart before documenting their first treatment.", href: "/patients/new", label: "Create a chart", icon: UserPlus },
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
    <div className="flex flex-col gap-8 lg:gap-10">
      <section className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div><p className="eyebrow mb-3 text-primary">Your clinic, in focus</p><h1 className="editorial-title text-4xl leading-tight sm:text-5xl">Welcome to your workspace.</h1><p className="mt-3 text-base leading-7 text-muted-foreground">A little clarity for every patient journey.</p></div>
        <Link href="/capture" className={buttonVariants({ size: "lg", className: "self-start sm:shrink-0" })}><Camera aria-hidden="true" />New capture</Link>
      </section>
      <section className="relative overflow-hidden rounded-3xl border border-border bg-secondary p-7 sm:p-10">
        <div className="relative z-10 max-w-xl"><p className="eyebrow mb-4 text-primary">{workspace.activeMembership?.organizationName}</p><h2 className="editorial-title text-3xl leading-tight sm:text-4xl">Every detail deserves<br />a thoughtful record.</h2><p className="mt-4 max-w-md text-base leading-7 text-muted-foreground">Start with a patient chart, capture a consistent set of views, and keep their progress connected.</p><Link href="/patients" className="mt-6 inline-flex min-h-11 items-center gap-3 font-medium text-primary underline-offset-4 hover:underline">Open patient library <ArrowRight aria-hidden="true" className="size-4" /></Link></div>
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -bottom-24 size-80 rounded-full border-[40px] border-primary/5 sm:size-96" />
      </section>
      <section aria-labelledby="quick-actions-title"><div className="mb-5 flex flex-wrap items-center justify-between gap-2"><h2 id="quick-actions-title" className="text-lg font-medium">Make yourself at home</h2><span className="text-sm text-muted-foreground">Your everyday essentials</span></div><div className="grid gap-4 md:grid-cols-3">{quickActions.map(({ title, description, href, label, icon: Icon }) => <Link key={href} href={href} className="group flex flex-col rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/50 hover:bg-secondary/40"><span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary"><Icon aria-hidden="true" className="size-5" /></span><h3 className="mt-6 text-lg font-medium">{title}</h3><p className="mt-2 mb-6 text-base leading-7 text-muted-foreground">{description}</p><span className="mt-auto flex items-center justify-between gap-2 text-base font-medium text-primary">{label}<ArrowRight aria-hidden="true" className="size-4" /></span></Link>)}</div></section>
      <div className="flex items-start gap-3 rounded-2xl border border-border px-5 py-4"><ShieldCheck aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" /><p className="text-base leading-7 text-muted-foreground">A considered space for care. Original photographs stay unchanged, and patient sharing stays in your control.</p></div>
    </div>
  );
}
