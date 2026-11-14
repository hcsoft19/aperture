import "server-only";

import {
  listTreatmentPhotographs,
  listTreatmentSessions,
  listTreatments,
} from "@/features/patients/queries";
import { getReleasedTreatment } from "@/features/portal/queries";
import {
  buildTimeline,
  timelineImageAddress,
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
      const [sessions, photographs, previews] = await Promise.all([
        listTreatmentSessions(treatment.id),
        listTreatmentPhotographs(organizationId, treatment.id),
        viewer === "patient"
          ? releasedPreviewUrls(treatment.id)
          : Promise.resolve(new Map<string, string>()),
      ]);

      return { treatment, sessions, photographs, previews };
    }),
  );

  const input: TimelineInput = {
    viewer,
    treatments: loaded.map(({ treatment, sessions, photographs, previews }) => ({
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
            src: timelineImageAddress(
              viewer,
              session.releasedToPatient,
              photograph.id,
              previews.get(photograph.id),
            ),
          })),
      })),
    })),
  };

  return buildTimeline(input);
}

async function releasedPreviewUrls(treatmentId: string) {
  const released = await getReleasedTreatment(treatmentId);
  const previews = new Map<string, string>();

  for (const session of released?.sessions ?? []) {
    for (const photo of session.photos) {
      if (photo.previewUrl) {
        previews.set(photo.id, photo.previewUrl);
      }
    }
  }

  return previews;
}
