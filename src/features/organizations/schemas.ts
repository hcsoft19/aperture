import { z } from "zod";

export const organizationNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters.")
    .max(120, "Use 120 characters or fewer."),
});

export const profileNameSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, "Enter your name.")
    .max(120, "Use 120 characters or fewer."),
});

export const memberEmailSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export const memberRoleSchema = z.object({
  organizationId: z.string().uuid(),
  profileId: z.string().uuid(),
  role: z.enum(["clinic_admin", "professional"]),
});

export type OrganizationNameValues = z.infer<typeof organizationNameSchema>;
export type ProfileNameValues = z.infer<typeof profileNameSchema>;
export type MemberEmailValues = z.infer<typeof memberEmailSchema>;
