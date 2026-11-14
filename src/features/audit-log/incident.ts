/**
 * Checklist for a suspected sharing incident.
 * This is not a claim that an incident team exists.
 */
export type IncidentNote = {
  readonly steps: readonly string[];
  readonly disclaimer: string;
};

export function incidentNote(): IncidentNote {
  return Object.freeze({
    steps: Object.freeze([
      "Stop sharing.",
      "Preserve the audit row.",
      "Do not put photographs in the note.",
    ]),
    disclaimer: "This checklist does not mean an incident team exists.",
  });
}
