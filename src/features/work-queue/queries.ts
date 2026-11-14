import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import {
  buildQueue,
  type QueueConsent,
  type QueueInput,
  type QueuePatient,
  type QueueSession,
} from "./queue";

const DRAFT_LIMIT = 50;
const RECENT_LIMIT = 20;
const PATIENT_LIMIT = 200;

const SESSION_COLUMNS =
  "id, status, session_type, updated_at, treatments!inner(name, patients!inner(id, first_name, last_name, organization_id))";

const sessionSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  status: z.enum(["draft", "completed", "cancelled"]),
  sessionType: z.enum(["baseline", "follow_up"]),
  patientId: z.string().min(1),
  patientName: z.string(),
  treatmentName: z.string(),
  updatedAt: z.string().min(1),
});

const patientSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  name: z.string(),
});

const consentSchema = z.object({
  patientId: z.string().min(1),
  organizationId: z.string().min(1),
  purpose: z.string(),
  revokedAt: z.string().nullable(),
});

export async function listWorkQueue(organizationId: string) {
  const supabase = await createClient();
  const [drafts, completed, patients] = await Promise.all([
    supabase
      .from("photo_sessions")
      .select(SESSION_COLUMNS)
      .eq("status", "draft")
      .eq("treatments.patients.organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .limit(DRAFT_LIMIT),
    supabase
      .from("photo_sessions")
      .select(SESSION_COLUMNS)
      .eq("status", "completed")
      .eq("treatments.patients.organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .limit(RECENT_LIMIT),
    supabase
      .from("patients")
      .select(
        "id, first_name, last_name, organization_id, consents(purpose, revoked_at, organization_id)",
      )
      .eq("organization_id", organizationId)
      .order("last_name")
      .order("first_name")
      .limit(PATIENT_LIMIT),
  ]);

  if (drafts.error || completed.error || patients.error) {
    throw new Error("Could not load the work queue.");
  }

  const sessions = [...(drafts.data ?? []), ...(completed.data ?? [])].flatMap(
    (row) => {
      const session = readSession(row);
      return session ? [session] : [];
    },
  );
  const charts = (patients.data ?? []).flatMap((row) => {
    const chart = readChart(row);
    return chart ? [chart] : [];
  });

  const input: QueueInput = {
    organizationId,
    sessions,
    patients: charts.map((chart) => chart.patient),
    consents: charts.flatMap((chart) => chart.consents),
  };

  return buildQueue(input);
}

function readSession(row: unknown): QueueSession | null {
  const record = asRecord(row);
  const treatment = asRecord(record?.treatments);
  const patient = asRecord(treatment?.patients);
  if (!record || !treatment || !patient) {
    return null;
  }

  const parsed = sessionSchema.safeParse({
    id: record.id,
    organizationId: patient.organization_id,
    status: record.status,
    sessionType: record.session_type,
    patientId: patient.id,
    patientName: joinName(patient.first_name, patient.last_name),
    treatmentName: treatment.name,
    updatedAt: record.updated_at,
  });

  return parsed.success ? parsed.data : null;
}

function readChart(
  row: unknown,
): { patient: QueuePatient; consents: QueueConsent[] } | null {
  const record = asRecord(row);
  if (!record) {
    return null;
  }

  const patient = patientSchema.safeParse({
    id: record.id,
    organizationId: record.organization_id,
    name: joinName(record.first_name, record.last_name),
  });
  if (!patient.success) {
    return null;
  }

  const consents = (Array.isArray(record.consents) ? record.consents : []).flatMap(
    (entry) => {
      const consent = asRecord(entry);
      if (!consent) {
        return [];
      }

      const parsed = consentSchema.safeParse({
        patientId: patient.data.id,
        organizationId: consent.organization_id,
        purpose: consent.purpose,
        revokedAt: Object.hasOwn(consent, "revoked_at") ? consent.revoked_at : undefined,
      });
      return parsed.success ? [parsed.data] : [];
    },
  );

  return { patient: patient.data, consents };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  const entry = Array.isArray(value) ? value[0] : value;
  if (!entry || typeof entry !== "object") {
    return null;
  }

  return entry as Record<string, unknown>;
}

function joinName(first: unknown, last: unknown) {
  return [first, last]
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
