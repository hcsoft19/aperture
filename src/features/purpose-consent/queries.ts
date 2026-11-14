import "server-only";

import { CONSENT_PURPOSES, consentVersion, isConsentPurpose } from "@/features/purpose-consent/purposes";
import type { ConsentRecord } from "@/features/purpose-consent/rules";
import { createClient } from "@/lib/supabase/server";

export async function listPurposeConsents(
  organizationId: string,
  patientId: string,
): Promise<ConsentRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("consents")
    .select("id, purpose, granted_by, granted_at, revoked_at")
    .eq("organization_id", organizationId)
    .eq("patient_id", patientId)
    .in("purpose", [...CONSENT_PURPOSES]);

  if (error) {
    throw new Error("Could not load consent.");
  }

  return (data ?? []).flatMap((row): ConsentRecord[] => {
    if (!isConsentPurpose(row.purpose) || !row.granted_by) {
      return [];
    }

    return [
      {
        id: row.id,
        purpose: row.purpose,
        version: consentVersion(row.purpose),
        grantedBy: row.granted_by,
        grantedAt: row.granted_at,
        revokedAt: row.revoked_at,
      },
    ];
  });
}
