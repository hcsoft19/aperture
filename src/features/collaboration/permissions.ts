import { z } from "zod";

export const collaborationActions = [
  "manage_templates",
  "manage_members",
  "release_to_patient",
  "capture",
  "edit_chart",
] as const;

export type CollaborationAction = (typeof collaborationActions)[number];

const actionSchema = z.enum(collaborationActions);

const professionalActions = new Set<CollaborationAction>([
  "capture",
  "edit_chart",
  "release_to_patient",
]);

/** Clinic administrators can do every action. Professionals can capture, chart, and release. */
export function can(role: string, action: string): boolean {
  const parsed = actionSchema.safeParse(action);

  if (!parsed.success) {
    return false;
  }

  if (role === "clinic_admin") {
    return true;
  }

  if (role === "professional") {
    return professionalActions.has(parsed.data);
  }

  return false;
}

export function roleLabel(role: string): string {
  if (role === "clinic_admin") {
    return "Clinic administrator";
  }

  if (role === "professional") {
    return "Professional";
  }

  return "Unknown role";
}
