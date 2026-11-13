import "server-only";

import { patientSearchFilter } from "@/features/patients/search";
import type { TreatmentStatus } from "@/features/patients/schemas";
import { createClient } from "@/lib/supabase/server";

export type PatientSummary = {
  id: string;
  firstName: string;
  lastName: string;
  contactEmail: string | null;
};

export type PatientRecord = PatientSummary & {
  dateOfBirth: string | null;
  phone: string | null;
};

export type TreatmentRecord = {
  id: string;
  name: string;
  category: string;
  bodyArea: string;
  description: string | null;
  startDate: string | null;
  status: TreatmentStatus;
};

export async function listPatients(organizationId: string, search: string) {
  const supabase = await createClient();
  let query = supabase
    .from("patients")
    .select("id, first_name, last_name, contact_email")
    .eq("organization_id", organizationId)
    .order("last_name")
    .order("first_name")
    .limit(200);

  const filter = patientSearchFilter(search);
  if (filter) {
    query = query.or(filter);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error("Could not load patients.");
  }

  return (data ?? []).map(
    (row): PatientSummary => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      contactEmail: row.contact_email,
    }),
  );
}

export async function getPatient(organizationId: string, patientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .select("id, first_name, last_name, contact_email, date_of_birth, phone")
    .eq("organization_id", organizationId)
    .eq("id", patientId)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load the chart.");
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    firstName: data.first_name,
    lastName: data.last_name,
    contactEmail: data.contact_email,
    dateOfBirth: data.date_of_birth,
    phone: data.phone,
  } satisfies PatientRecord;
}

export async function listTreatments(patientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("treatments")
    .select("id, name, category, body_area, description, start_date, status")
    .eq("patient_id", patientId)
    .order("start_date", { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error("Could not load treatments.");
  }

  return (data ?? []).map(toTreatment);
}

export async function getTreatment(
  organizationId: string,
  patientId: string,
  treatmentId: string,
) {
  const patient = await getPatient(organizationId, patientId);
  if (!patient) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("treatments")
    .select("id, name, category, body_area, description, start_date, status")
    .eq("patient_id", patientId)
    .eq("id", treatmentId)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load the treatment.");
  }

  return data ? toTreatment(data) : null;
}

export async function countPhotographs(patientId: string, treatmentIds: string[]) {
  if (treatmentIds.length === 0) {
    return 0;
  }

  const supabase = await createClient();
  const { count, error } = await supabase
    .from("photos")
    .select("id, photo_sessions!inner(treatment_id, treatments!inner(patient_id))", {
      count: "exact",
      head: true,
    })
    .eq("upload_status", "uploaded")
    .eq("photo_sessions.treatments.patient_id", patientId)
    .in("photo_sessions.treatment_id", treatmentIds);

  if (error) {
    throw new Error("Could not load photograph history.");
  }

  return count ?? 0;
}

export type TreatmentSessionSummary = {
  id: string;
  sessionType: "baseline" | "follow_up";
  status: "draft" | "completed" | "cancelled";
  sessionDate: string;
};

export async function listTreatmentSessions(treatmentId: string): Promise<TreatmentSessionSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("photo_sessions")
    .select("id, session_type, status, session_date")
    .eq("treatment_id", treatmentId)
    .order("session_date", { ascending: false });

  if (error) {
    throw new Error("Could not load photograph history.");
  }

  return (data ?? []).map((session) => ({
    id: session.id,
    sessionType: session.session_type,
    status: session.status,
    sessionDate: session.session_date,
  }));
}

function toTreatment(row: {
  id: string;
  name: string;
  category: string;
  body_area: string;
  description: string | null;
  start_date: string | null;
  status: TreatmentStatus;
}): TreatmentRecord {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    bodyArea: row.body_area,
    description: row.description,
    startDate: row.start_date,
    status: row.status,
  };
}
