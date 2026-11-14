import type { Metadata } from "next";
import { Suspense } from "react";
import { PhotoEditor } from "@/features/editor/photo-editor";
import { getEditablePhoto } from "@/features/editor/queries";
import { segmentationEnabled } from "@/features/photo-intelligence/segmentation/estimate";
import { staffChartContext } from "@/features/patients/access";
import { ChartMessage } from "@/features/patients/chart-message";
import { safeNextPath } from "@/lib/auth/paths";
import { isUuid } from "@/lib/ids";

export const metadata: Metadata = { title: "Edit photograph" };

export default function EditPhotoPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string; photoId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  return (
    <Suspense fallback={<p role="status">Loading photograph…</p>}>
      <EditPhotoContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EditPhotoContent({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string; photoId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const access = await staffChartContext();
  if (!access.ok) {
    return <ChartMessage title="Edit photograph" message={access.message} />;
  }

  const [{ patientId, photoId }, query] = await Promise.all([params, searchParams]);
  if (!isUuid(patientId) || !isUuid(photoId)) {
    return <ChartMessage title="Edit photograph" message="This photograph is not available." />;
  }

  const photo = await getEditablePhoto(access.organizationId, patientId, photoId);
  if (!photo) {
    return <ChartMessage title="Edit photograph" message="This photograph is not available." />;
  }

  return (
    <PhotoEditor
      photoId={photo.id}
      angleName={photo.angleName}
      signedUrl={photo.signedUrl}
      backHref={query.from ? safeNextPath(query.from) : `/patients/${patientId}`}
      initialEdit={photo.edit}
      initialRevisionId={photo.revisionId}
      face={photo.face}
      segmentationAvailable={segmentationEnabled(process.env.NEXT_PUBLIC_SEGMENTATION)}
    />
  );
}
