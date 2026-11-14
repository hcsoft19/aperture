export const progressGalleryMount = {
  name: "progress-gallery",
  href: "/patients/[patientId]/progress",
  label: "Progress",
} as const;

export function progressGalleryPath(patientId: string) {
  return `/patients/${patientId}/progress`;
}
