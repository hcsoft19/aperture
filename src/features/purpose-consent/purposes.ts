export const CONSENT_VERSION = 1;

export const CONSENT_PURPOSES = [
  "Clinical photography",
  "Patient portal sharing",
  "Marketing publication",
] as const;

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export const CONSENT_PURPOSE_DETAILS: Record<ConsentPurpose, string> = {
  "Clinical photography":
    "Allows clinical photographs for this chart. It does not allow portal sharing or marketing.",
  "Patient portal sharing":
    "Allows photographs from this chart to be shared in the patient portal.",
  "Marketing publication":
    "Allows photographs from this chart to be used in marketing.",
};

/** Purpose text plus the current consent version, for example "Clinical photography 1". */
export function consentVersion(purpose: ConsentPurpose): string {
  return `${purpose} ${CONSENT_VERSION}`;
}

export function isConsentPurpose(value: string): value is ConsentPurpose {
  return (CONSENT_PURPOSES as readonly string[]).includes(value);
}
