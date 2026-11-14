import "server-only";

import { z } from "zod";

import {
  clinicMemberRowsSchema,
  teamLoadError,
  toClinicTeamMember,
  type ClinicTeamMember,
} from "@/features/collaboration/schema";
import { createClient } from "@/lib/supabase/server";

export type ClinicTeamList =
  | { ok: true; members: ClinicTeamMember[] }
  | { ok: false; message: string };

function byRoleThenName(a: ClinicTeamMember, b: ClinicTeamMember) {
  const rank = (role: string) => {
    if (role === "clinic_admin") {
      return 0;
    }

    if (role === "professional") {
      return 1;
    }

    return 2;
  };

  const roleDelta = rank(a.role) - rank(b.role);
  if (roleDelta !== 0) {
    return roleDelta;
  }

  if (!a.fullName && b.fullName) {
    return 1;
  }

  if (a.fullName && !b.fullName) {
    return -1;
  }

  const nameDelta = (a.fullName ?? "").localeCompare(b.fullName ?? "", "en");
  if (nameDelta !== 0) {
    return nameDelta;
  }

  return a.profileId.localeCompare(b.profileId);
}

export async function listClinicMembers(organizationId: string): Promise<ClinicTeamList> {
  if (!z.uuid().safeParse(organizationId).success) {
    return { ok: false, message: teamLoadError };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("organization_members")
      .select("profile_id, role, profiles(full_name)")
      .eq("organization_id", organizationId);

    if (error) {
      return { ok: false, message: teamLoadError };
    }

    const parsed = clinicMemberRowsSchema.safeParse(data ?? []);
    if (!parsed.success) {
      return { ok: false, message: teamLoadError };
    }

    return {
      ok: true,
      members: parsed.data.map(toClinicTeamMember).sort(byRoleThenName),
    };
  } catch {
    return { ok: false, message: teamLoadError };
  }
}
