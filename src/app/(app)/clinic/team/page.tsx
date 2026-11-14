import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getWorkspace } from "@/features/access/workspace";
import { teamMount } from "@/features/collaboration/mount";
import { listClinicMembers } from "@/features/collaboration/queries";
import { roleLabel } from "@/features/collaboration/permissions";
import { ChartMessage } from "@/features/patients/chart-message";

export const metadata: Metadata = {
  title: teamMount.label,
  robots: { index: false, follow: false },
};

export default function TeamPage() {
  return (
    <Suspense
      fallback={
        <p className="text-base text-muted-foreground">Loading the team…</p>
      }
    >
      <TeamContent />
    </Suspense>
  );
}

async function TeamContent() {
  const workspace = await getWorkspace();

  if (!workspace) {
    redirect("/login");
  }

  if (workspace.kind !== "staff" || !workspace.activeMembership) {
    return (
      <ChartMessage
        title={teamMount.label}
        message="The clinic team is limited to clinic staff."
      />
    );
  }

  const team = await listClinicMembers(workspace.activeMembership.organizationId);

  if (!team.ok) {
    return <ChartMessage title={teamMount.label} message={team.message} />;
  }

  return (
    <section className="flex max-w-2xl flex-col gap-6" aria-labelledby="clinic-team-heading">
      <div>
        <h1 id="clinic-team-heading" className="text-2xl font-semibold tracking-tight">
          {teamMount.label}
        </h1>
        <p className="mt-2 text-base leading-7 text-muted-foreground">
          {workspace.activeMembership.organizationName}
        </p>
      </div>
      {team.members.length === 0 ? (
        <p className="text-base leading-7 text-muted-foreground">
          No one is listed for this clinic.
        </p>
      ) : (
        <ul aria-label="Clinic team" className="flex flex-col gap-3">
          {team.members.map((member) => {
            const yours = member.profileId === workspace.user.id;
            const role = roleLabel(member.role);

            return (
              <li
                key={member.profileId}
                className="flex min-h-11 flex-col justify-center rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10"
              >
                <p className="text-base font-medium">
                  {member.fullName ?? "Unnamed professional"}
                </p>
                <p className="text-base text-muted-foreground">
                  {yours ? `${role} · You` : role}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
