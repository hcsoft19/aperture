import "server-only";

import {
  listTreatmentPhotographs,
  listTreatmentSessions,
  listTreatments,
} from "@/features/patients/queries";
import {
  buildTimeline,
  type TimelineInput,
  type TimelineViewer,
} from "@/features/patient-timeline/model";

export async function loadPatientTimeline(
  organizationId: string,
  patientId: string,
  viewer: TimelineViewer,
) {
  const treatments = await listTreatments(patientId);
  const loaded = await Promise.all(
    treatments.map(async (treatment) => {
      const [sessions, photographs] = await Promise.all([
        listTreatmentSessions(treatment.id),
        listTreatmentPhotographs(organizationId, treatment.id),
      ]);

      return { treatment, sessions, photographs };
    }),
  );

  const input: TimelineInput = {
    viewer,
    treatments: loaded.map(({ treatment, sessions, photographs }) => ({
      id: treatment.id,
      name: treatment.name,
      date: treatment.startDate,
      sessions: sessions.map((session) => ({
        id: session.id,
        date: session.sessionDate,
        sessionType: session.sessionType,
        images: photographs
          .filter((photograph) => photograph.sessionId === session.id)
          .map((photograph) => ({
            id: photograph.id,
            label: photograph.angleName,
            imageReleased: session.releasedToPatient,
            src:
              viewer === "staff" && session.releasedToPatient
                ? `/api/clinic-photos/${photograph.id}`
                : null,
          })),
      })),
    })),
  };

  return buildTimeline(input);
}
