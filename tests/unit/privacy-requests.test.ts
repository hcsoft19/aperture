import { describe, expect, it } from "vitest";

import {
  DELETION_RECORDED_MESSAGE,
  EXPORT_READY_MESSAGE,
  prepareExportManifest,
  privacyRefusalMessage,
  recordDeletionRequest,
  requestAutomaticDeletion,
  type PrivacyActor,
} from "@/features/privacy-requests/requests";

const clinicId = "11111111-1111-4111-8111-111111111111";
const otherClinicId = "22222222-2222-4222-8222-222222222222";
const adminId = "33333333-3333-4333-8333-333333333333";
const patientId = "6f1e2d3c-4b5a-4690-8a7b-1c2d3e4f5a6b";
const photoId = "44444444-4444-4444-8444-444444444444";

const admin = {
  profileId: adminId,
  organizationId: clinicId,
  role: "clinic_admin",
} satisfies PrivacyActor;

const source = {
  patientId,
  organizationId: clinicId,
  treatmentLabels: ["Laser"],
  consentPurposeNames: ["Clinical photography"],
  photos: [
    {
      id: photoId,
      angleName: "Front",
      capturedAt: "2026-03-12T15:04:05.000Z",
      fileSizeBytes: 240112,
    },
  ],
};

describe("privacy requests", () => {
  it("prepares an export manifest for one patient", () => {
    const result = prepareExportManifest(admin, source);

    expect(result).toEqual({
      ok: true,
      message: EXPORT_READY_MESSAGE,
      manifest: {
        patientId,
        treatmentLabels: ["Laser"],
        consentPurposeNames: ["Clinical photography"],
        photos: [
          {
            id: photoId,
            angleName: "Front",
            capturedAt: "2026-03-12T15:04:05.000Z",
            fileSizeBytes: 240112,
          },
        ],
      },
    });
    expect(result.message).toBe("The export is ready.");

    if (!result.ok) {
      throw new Error("Expected an export manifest.");
    }

    expect(Object.keys(result.manifest).sort()).toEqual([
      "consentPurposeNames",
      "patientId",
      "photos",
      "treatmentLabels",
    ]);
    expect(Object.keys(result.manifest.photos[0] ?? {}).sort()).toEqual([
      "angleName",
      "capturedAt",
      "fileSizeBytes",
      "id",
    ]);
  });

  it("refuses a request for another organization", () => {
    expect(
      prepareExportManifest(admin, { ...source, organizationId: otherClinicId }),
    ).toEqual({
      ok: false,
      reason: "cross_organization",
      message: privacyRefusalMessage.cross_organization,
    });

    expect(
      recordDeletionRequest(admin, {
        patientId,
        organizationId: otherClinicId,
      }),
    ).toEqual({
      ok: false,
      reason: "cross_organization",
      message: privacyRefusalMessage.cross_organization,
    });
  });

  it("rejects a manifest that includes image bytes", () => {
    const result = prepareExportManifest(admin, {
      ...source,
      photos: [
        {
          ...source.photos[0],
          imageBytes: Uint8Array.from([1, 2, 3, 4]),
        },
      ],
    });

    expect(result).toEqual({
      ok: false,
      reason: "image_bytes",
      message: privacyRefusalMessage.image_bytes,
    });
    expect(JSON.stringify(result)).not.toContain("imageBytes");
    expect(result).not.toHaveProperty("manifest");
  });

  it("rejects storage paths, signed URLs, and embeddings", () => {
    expect(
      prepareExportManifest(admin, {
        ...source,
        photos: [
          {
            ...source.photos[0],
            storagePath: "clinical-photos/11111111-1111-4111-8111-111111111111/original.jpg",
          },
        ],
      }),
    ).toMatchObject({ ok: false, reason: "storage_path" });

    expect(
      prepareExportManifest(admin, {
        ...source,
        photos: [
          {
            ...source.photos[0],
            signedUrl: "https://example.test/photo?X-Amz-Signature=abc",
          },
        ],
      }),
    ).toMatchObject({ ok: false, reason: "signed_url" });

    expect(
      prepareExportManifest(admin, {
        ...source,
        photos: [{ ...source.photos[0], embedding: [0.1, 0.2, 0.3] }],
      }),
    ).toMatchObject({ ok: false, reason: "embedding" });
  });

  it("records a deletion request without a delete instruction", () => {
    const result = recordDeletionRequest(admin, {
      patientId,
      organizationId: clinicId,
    });

    expect(result).toEqual({
      ok: true,
      message: DELETION_RECORDED_MESSAGE,
      request: {
        status: "requested",
        organizationId: clinicId,
        patientId,
        requestedBy: adminId,
      },
    });
    expect(result.message).toBe(
      "The deletion request was recorded. Photographs were not deleted.",
    );

    if (!result.ok) {
      throw new Error("Expected a recorded deletion request.");
    }

    expect(Object.keys(result).sort()).toEqual(["message", "ok", "request"]);
    expect(Object.keys(result.request).sort()).toEqual([
      "organizationId",
      "patientId",
      "requestedBy",
      "status",
    ]);
    expect(result.request).not.toHaveProperty("delete");
    expect(result.request).not.toHaveProperty("instruction");
    expect(result.request).not.toHaveProperty("purge");

    const commanded = recordDeletionRequest(admin, {
      patientId,
      organizationId: clinicId,
      delete: true,
    });
    expect(commanded).toEqual({
      ok: false,
      reason: "backup_retention",
      message: privacyRefusalMessage.backup_retention,
    });
    expect(commanded).not.toHaveProperty("delete");
    expect(commanded).not.toHaveProperty("instruction");
    expect(JSON.stringify(commanded)).not.toContain('"delete"');

    const automatic = requestAutomaticDeletion();
    expect(automatic).toEqual({
      ok: false,
      reason: "backup_retention",
      message: privacyRefusalMessage.backup_retention,
    });
    expect(automatic).not.toHaveProperty("request");
    expect(automatic).not.toHaveProperty("delete");
    expect(automatic).not.toHaveProperty("instruction");
  });
});
