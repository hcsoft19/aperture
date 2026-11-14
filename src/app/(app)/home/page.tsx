import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ClinicGallery } from "@/features/gallery/gallery";
import {
  getGalleryFacets,
  listClinicResults,
} from "@/features/gallery/queries";
import {
  defaultGalleryFilters,
  emptyGalleryFacets,
  type GalleryPage,
} from "@/features/gallery/models";
import { getWorkspace } from "@/features/access/workspace";
import { CreateClinicForm } from "@/features/organizations/create-clinic-form";

export const metadata: Metadata = {
  title: "Home",
};

export default function WorkspaceHomePage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Loading home…</p>}
    >
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
          <h1 className="text-2xl font-semibold tracking-tight">
            Create your clinic
          </h1>
          <p className="mt-2 text-base leading-7 text-muted-foreground">
            This account is not part of a clinic yet. The clinic you create is
            separate from every other clinic.
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
          You can see clinics that have linked this account. Photographs appear
          here only after a professional releases them.
        </p>
        <ul className="flex flex-col gap-3">
          {workspace.patientLinks.map((link) => (
            <li
              key={link.patientId}
              className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
            >
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

  if (!workspace.activeMembership) return null;
  let initialPage: GalleryPage = { items: [], nextCursor: null, total: 0 };
  let initialError = "";
  let facets = emptyGalleryFacets;
  try {
    [initialPage, facets] = await Promise.all([
      listClinicResults(workspace.activeMembership.organizationId, {
        ...defaultGalleryFilters,
        cursor: null,
      }),
      getGalleryFacets(workspace.activeMembership.organizationId),
    ]);
  } catch {
    initialError = "The clinic gallery could not be loaded. Please try again.";
  }
  return (
    <ClinicGallery
      clinicName={workspace.activeMembership.organizationName}
      initialPage={initialPage}
      initialError={initialError}
      facets={facets}
    />
  );
}
