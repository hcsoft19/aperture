const ITEMS = [
  "The demo uses synthetic records.",
  "Real patients are not allowed yet.",
  "Consent is separate for clinical photography, portal sharing, and marketing.",
  "Support is the clinic administrator.",
] as const;

export type ReadinessItem = (typeof ITEMS)[number];

/**
 * Statements a clinic administrator can read before any real-patient use.
 */
export function readinessChecklist(): readonly ReadinessItem[] {
  return [...ITEMS];
}
