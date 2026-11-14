import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaptureWizard } from "@/features/capture/capture-wizard";
import { describePhotograph, jpegFromDecodedBitmap } from "@/features/capture/media";
import { cancelCaptureAction, finishCaptureAction, preparePhotoAction } from "@/features/capture/actions";
import type { CaptureSessionView } from "@/features/capture/queries";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  unstable_rethrow: (error: unknown) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      typeof error.digest === "string" &&
      error.digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
  },
}));
vi.mock("@/features/capture/actions", () => ({ preparePhotoAction: vi.fn(), discardPhotoAction: vi.fn(), finalizePhotoAction: vi.fn(), finishCaptureAction: vi.fn(), cancelCaptureAction: vi.fn() }));
vi.mock("@/features/capture/media", () => ({
  describePhotograph: vi.fn(),
  isCaptureMime: (value: string) => value === "image/jpeg" || value === "image/png" || value === "image/webp",
  frameFromVideo: vi.fn(),
  jpegFromDecodedBitmap: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("@/features/capture/quality-actions", () => ({ recordCaptureQualityAction: vi.fn(), saveCaptureSettingsAction: vi.fn() }));

const session: CaptureSessionView = {
  id: "demo-session", status: "draft", sessionType: "baseline", patientName: "Demo Patient", treatmentName: "Demo", bodyArea: "Face",
  protocol: { id: "protocol", code: "DEMO", version: 1, name: "Demo protocol", angles: [{ id: "front", code: "front", name: "Front", sortOrder: 1, instructions: "Face the camera." }] },
  photos: [], references: [], comparisons: [], guidanceEnabled: false, canManageGuidance: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("URL", { createObjectURL: () => "blob:demo", revokeObjectURL: vi.fn() });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function submitPhoto() {
  const user = userEvent.setup();
  render(<CaptureWizard session={session} />);
  await user.upload(screen.getByLabelText("Use a saved photograph"), new File(["invalid bytes"], "photo.jpg", { type: "image/jpeg" }));
  for (const label of ["The face matches the guide.", "The lighting is even.", "The expression is neutral."]) await user.click(screen.getByRole("checkbox", { name: label }));
  await user.click(screen.getByRole("button", { name: "Use this photograph" }));
  return user;
}

describe("capture error recovery", () => {
  it("shows an unreadable-image error and lets the user retake without uploading", async () => {
    vi.mocked(describePhotograph).mockResolvedValue(null);
    const user = await submitPhoto();
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be read");
    expect(jpegFromDecodedBitmap).not.toHaveBeenCalled();
    expect(preparePhotoAction).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Discard session" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Retake" }));
    expect(screen.getByLabelText("Use a saved photograph")).toBeInTheDocument();
  });

  it("unlocks retry and discard when the server action unexpectedly rejects", async () => {
    vi.mocked(describePhotograph).mockResolvedValue({ width: 1200, height: 1600, sha256: "a".repeat(64), mimeType: "image/jpeg", fileSizeBytes: 60 });
    vi.mocked(preparePhotoAction).mockRejectedValue(new Error("Network unavailable"));
    await submitPhoto();
    expect(await screen.findByRole("alert")).toHaveTextContent("Try again or choose another photograph");
    expect(screen.getByRole("button", { name: "Use this photograph" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Discard session" })).toBeEnabled();
  });

  it("accepts an untyped photograph the browser can decode and saves that JPEG", async () => {
    const jpeg = new File([Uint8Array.from([1, 2, 3])], "photograph.jpg", { type: "image/jpeg" });
    vi.mocked(jpegFromDecodedBitmap).mockResolvedValue(jpeg);
    vi.mocked(describePhotograph).mockResolvedValue({ width: 1200, height: 1600, sha256: "b".repeat(64), mimeType: "image/jpeg", fileSizeBytes: jpeg.size });
    vi.mocked(preparePhotoAction).mockResolvedValue({ status: "error", message: "The photograph could not be saved." });
    const user = userEvent.setup({ applyAccept: false });
    render(<CaptureWizard session={session} />);
    await user.upload(screen.getByLabelText("Use a saved photograph"), new File(["phone"], "IMG_0001", { type: "" }));
    expect(await screen.findByRole("img", { name: "Review of Front" })).toBeInTheDocument();
    for (const label of ["The face matches the guide.", "The lighting is even.", "The expression is neutral."]) {
      await user.click(screen.getByRole("checkbox", { name: label }));
    }
    await user.click(screen.getByRole("button", { name: "Use this photograph" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The photograph could not be saved.");
    expect(describePhotograph).toHaveBeenCalledWith(jpeg);
    expect(jpegFromDecodedBitmap).toHaveBeenCalledOnce();
  });

  it("shows the existing message and leaves Capture disabled when an untyped file cannot be decoded", async () => {
    vi.mocked(jpegFromDecodedBitmap).mockResolvedValue(null);
    const user = userEvent.setup({ applyAccept: false });
    render(<CaptureWizard session={session} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Capture" })).toBeDisabled());
    await user.upload(screen.getByLabelText("Use a saved photograph"), new File(["not-an-image"], "IMG_0001", { type: "" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Use a JPEG, PNG, or WebP photograph.");
    expect(screen.getByRole("button", { name: "Capture" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Use this photograph" })).not.toBeInTheDocument();
  });

  it("keeps JPEG, PNG, and WebP on the saved-photograph path", async () => {
    const user = userEvent.setup();
    for (const type of ["image/jpeg", "image/png", "image/webp"] as const) {
      cleanup();
      vi.clearAllMocks();
      render(<CaptureWizard session={session} />);
      await user.upload(screen.getByLabelText("Use a saved photograph"), new File(["pixels"], "photo", { type }));
      expect(await screen.findByRole("img", { name: "Review of Front" })).toBeInTheDocument();
      expect(jpegFromDecodedBitmap).not.toHaveBeenCalled();
    }
  });

  it("shows a plain error and enables Finish and Discard when finishing throws", async () => {
    vi.mocked(finishCaptureAction).mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    render(<CaptureWizard session={session} />);
    await user.click(screen.getByRole("button", { name: "Finish session" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The session could not be finished.");
    expect(screen.getByRole("button", { name: "Finish session" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Discard session" })).toBeEnabled();
  });

  it("shows a plain error and enables Finish and Discard when cancelling throws", async () => {
    vi.mocked(cancelCaptureAction).mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    render(<CaptureWizard session={session} />);
    await user.click(screen.getByRole("button", { name: "Discard session" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The session could not be finished.");
    expect(screen.getByRole("button", { name: "Finish session" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Discard session" })).toBeEnabled();
  });

  it("shows a returned finish error and enables the buttons again", async () => {
    vi.mocked(finishCaptureAction).mockResolvedValue({ status: "error", message: "Add a reason for the missing angles." });
    const user = userEvent.setup();
    render(<CaptureWizard session={session} />);
    await user.click(screen.getByRole("button", { name: "Finish session" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Add a reason for the missing angles.");
    expect(screen.getByRole("button", { name: "Finish session" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Discard session" })).toBeEnabled();
  });

  it("leaves Finish and Discard disabled when finishing does not return", async () => {
    vi.mocked(finishCaptureAction).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<CaptureWizard session={session} />);
    await user.click(screen.getByRole("button", { name: "Finish session" }));
    expect(screen.getByRole("button", { name: "Finish session" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Discard session" })).toBeDisabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not treat navigation as a failed finish", async () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/capture/demo-session;307;",
    });
    vi.mocked(finishCaptureAction).mockRejectedValue(redirectError);
    const user = userEvent.setup();
    render(<CaptureWizard session={session} />);
    const rejections: unknown[] = [];
    const onRejection = (error: unknown) => {
      rejections.push(error);
    };
    process.on("unhandledRejection", onRejection);
    try {
      await user.click(screen.getByRole("button", { name: "Finish session" }));
      await vi.waitFor(() => expect(rejections).toContain(redirectError));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Finish session" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Discard session" })).toBeDisabled();
    } finally {
      process.off("unhandledRejection", onRejection);
    }
  });
});
