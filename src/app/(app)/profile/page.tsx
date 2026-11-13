import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { getWorkspace } from "@/features/access/workspace";
import { signOutAction } from "@/features/auth/actions";
import {
  ClinicSettings,
  type ClinicMember,
} from "@/features/organizations/clinic-settings";
import { ProfileNameForm } from "@/features/organizations/profile-name-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Profile",
};

export default function ProfilePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading profile…</p>}>
      <ProfileContent />
    </Suspense>
  );
}

async function ProfileContent() {
  const workspace = await getWorkspace();

  if (!workspace) {
    redirect("/login");
  }

  const members = workspace.activeMembership
    ? await loadMembers(workspace.activeMembership.organizationId)
    : [];

  return (
    <section className="flex max-w-2xl flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-2 text-base leading-7 text-muted-foreground">
          {workspace.user.email ?? "Signed in"}
        </p>
      </div>
      <ProfileNameForm fullName={workspace.fullName} />
      {workspace.kind === "staff" && workspace.activeMembership ? (
        <ClinicSettings
          organizationId={workspace.activeMembership.organizationId}
          organizationName={workspace.activeMembership.organizationName}
          currentProfileId={workspace.user.id}
          isAdmin={workspace.activeMembership.role === "clinic_admin"}
          members={members}
        />
      ) : null}
      {workspace.kind === "patient" ? (
        <div>
          <h2 className="text-lg font-semibold">Clinics</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {workspace.patientLinks.map((link) => (
              <li key={link.patientId} className="text-base">
                {link.organizationName}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <form action={signOutAction} className="border-t border-border pt-6">
        <Button type="submit" variant="outline" size="lg">
          Sign out
        </Button>
      </form>
    </section>
  );
}

async function loadMembers(organizationId: string): Promise<ClinicMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("profile_id, role, profiles(full_name)")
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error("Could not load clinic members.");
  }

  return (data ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      profileId: row.profile_id,
      fullName: profile?.full_name ?? null,
      role: row.role,
    };
  });
}
