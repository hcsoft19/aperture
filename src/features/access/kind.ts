export type WorkspaceKind = "needs_clinic" | "staff" | "patient";

/** Staff membership wins when a person is both a professional and a patient. */
export function resolveWorkspaceKind(
  staffCount: number,
  patientLinkCount: number,
): WorkspaceKind {
  if (staffCount > 0) {
    return "staff";
  }

  if (patientLinkCount > 0) {
    return "patient";
  }

  return "needs_clinic";
}
