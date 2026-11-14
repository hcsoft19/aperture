import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getWorkspace } from "@/features/access/workspace";
import { ChartMessage } from "@/features/patients/chart-message";
import {
  getStaffClinicProfile,
  listStaffPublications,
  listPublicationSources,
  listPublicationAudit,
} from "@/features/clinic-showcase/queries";
import { ProfileEditor } from "@/features/clinic-showcase/profile-editor";
import { PublicationManager } from "@/features/clinic-showcase/publication-manager";
import { siteOrigin } from "@/features/clinic-showcase/site-url";
export const metadata = {
  title: "Clinic showcase",
  robots: { index: false, follow: false },
};
export default function ClinicSettingsPage() {
  return (
    <Suspense
      fallback={
        <p className="text-base text-muted-foreground">
          Loading clinic settings…
        </p>
      }
    >
      <Content />
    </Suspense>
  );
}
async function Content() {
  const w = await getWorkspace();
  if (!w) redirect("/login");
  if (w.kind !== "staff" || !w.activeMembership)
    return (
      <ChartMessage
        title="Clinic settings"
        message="Clinic settings are limited to clinic staff."
      />
    );
  const org = w.activeMembership.organizationId;
  const [profile, results, sources, audit] = await Promise.all([
    getStaffClinicProfile(org),
    listStaffPublications(org),
    listPublicationSources(org),
    listPublicationAudit(org),
  ]);
  const canEdit = w.activeMembership.role === "clinic_admin";
  return (
    <div className="space-y-9">
      <header>
        <p className="eyebrow mb-3 text-primary">Your clinic, introduced</p>
        <h1 className="editorial-title text-4xl sm:text-5xl">
          A place for your practice.
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          Bring your identity, contact details, and selected results together in
          one shareable page.
        </p>
      </header>
      <nav
        aria-label="Clinic settings sections"
        className="flex flex-wrap gap-3 border-b border-border pb-4"
      >
        <a
          href="#profile"
          className="inline-flex min-h-11 items-center rounded-lg bg-secondary px-4 text-base font-medium text-primary"
        >
          Profile & publishing
        </a>
        <a
          href="#public-gallery"
          className="inline-flex min-h-11 items-center rounded-lg px-4 text-base font-medium text-primary hover:bg-muted"
        >
          Public gallery
        </a>
      </nav>
      <section id="profile" className="scroll-mt-6">
        <ProfileEditor
          profile={profile}
          clinicName={w.activeMembership.organizationName}
          canEdit={canEdit}
          origin={siteOrigin()}
        />
      </section>
      <section
        id="public-gallery"
        className="scroll-mt-6 border-t border-border pt-9"
      >
        <PublicationManager
          results={results}
          sources={sources}
          canEdit={canEdit}
        />
      </section>
      <details className="rounded-xl border border-border p-5">
        <summary className="min-h-11 cursor-pointer py-2 text-base font-medium">
          Recent publishing activity
        </summary>
        <ul className="mt-4 space-y-3">
          {audit.map((event) => (
            <li
              key={event.id}
              className="border-t border-border pt-3 text-sm leading-6"
            >
              <span className="font-medium">{event.actor}</span> ·{" "}
              {event.action.replaceAll("_", " ")} ·{" "}
              {new Date(event.created_at).toLocaleString("en", {
                timeZone: "UTC",
              })}{" "}
              UTC
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
