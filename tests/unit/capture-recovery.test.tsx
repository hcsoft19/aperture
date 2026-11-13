import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaptureWizard } from "@/features/capture/capture-wizard";
import { describePhotograph } from "@/features/capture/media";
import { preparePhotoAction } from "@/features/capture/actions";
import type { CaptureSessionView } from "@/features/capture/queries";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/capture/actions", () => ({ preparePhotoAction: vi.fn(), discardPhotoAction: vi.fn(), finalizePhotoAction: vi.fn(), finishCaptureAction: vi.fn(), cancelCaptureAction: vi.fn() }));
vi.mock("@/features/capture/media", () => ({ describePhotograph: vi.fn(), isCaptureMime: () => true, frameFromVideo: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

const session: CaptureSessionView = {
  id: "demo-session", status: "draft", sessionType: "baseline", patientName: "Demo Patient", treatmentName: "Demo", bodyArea: "Face",
  protocol: { id: "protocol", code: "DEMO", version: 1, name: "Demo protocol", angles: [{ id: "front", code: "front", name: "Front", sortOrder: 1, instructions: "Face the camera." }] },
  photos: [], references: [], comparisons: [],
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
});
