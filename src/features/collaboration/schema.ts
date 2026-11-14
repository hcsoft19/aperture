import { z } from "zod";

export const teamLoadError = "The clinic team could not be loaded.";

const profileSchema = z.object({
  full_name: z.string().nullable(),
});

export const clinicMemberRowSchema = z.object({
  profile_id: z.uuid(),
  role: z.string().min(1),
  profiles: z.union([
    profileSchema.nullable(),
    z.array(profileSchema.nullable()),
  ]),
});

export const clinicMemberRowsSchema = z.array(clinicMemberRowSchema);

export type ClinicMemberRow = z.infer<typeof clinicMemberRowSchema>;

export type ClinicTeamMember = {
  profileId: string;
  fullName: string | null;
  role: string;
};

export function toClinicTeamMember(row: ClinicMemberRow): ClinicTeamMember {
  const profile = Array.isArray(row.profiles) ? (row.profiles[0] ?? null) : row.profiles;
  const fullName = profile?.full_name?.trim() ?? "";

  return {
    profileId: row.profile_id,
    fullName: fullName.length > 0 ? fullName : null,
    role: row.role,
  };
}
