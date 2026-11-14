import { afterEach, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionPhotographs } from "@/features/capture/session-photographs";
import { CaptureSetup } from "@/features/capture/capture-setup";
vi.mock("@/features/capture/actions", () => ({ startCaptureAction: vi.fn() }));
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <span role="img" aria-label={alt} data-src={src} />
  ),
}));
afterEach(cleanup);
it("displays every saved body view with a link to its session", () => {
  render(
    <SessionPhotographs
      photos={[
        { id: "one", sessionId: "saved-session", angleName: "Body front" },
        { id: "two", sessionId: "saved-session", angleName: "Body side" },
        { id: "three", sessionId: "saved-session", angleName: "Body back" },
      ]}
    />,
  );
  expect(screen.getAllByRole("img")).toHaveLength(3);
  expect(
    screen.getByRole("link", { name: "View Body side photograph" }),
  ).toHaveAttribute("href", "/capture/saved-session");
});
it("defaults to follow-up when a baseline already exists, without starting another baseline", async () => {
  render(
    <CaptureSetup
      targets={[
        {
          treatmentId: "existing",
          treatmentName: "Existing case",
          bodyArea: "Hands",
          patientId: "p",
          patientName: "Synthetic",
          hasConsent: true,
          hasBaseline: true,
        },
        {
          treatmentId: "new",
          treatmentName: "New case",
          bodyArea: "Hands",
          patientId: "p",
          patientName: "Synthetic",
          hasConsent: true,
          hasBaseline: false,
        },
      ]}
    />,
  );
  expect(screen.getByRole("radio", { name: "Follow-up" })).toBeChecked();
  await userEvent
    .setup()
    .selectOptions(screen.getByLabelText("Treatment"), "new");
  expect(screen.getByRole("radio", { name: "Baseline" })).toBeChecked();
});
it("opens a larger private photo from a completed session", () => {
  render(
    <SessionPhotographs
      openPhotographs
      photos={[
        { id: "one", sessionId: "saved-session", angleName: "Body front" },
      ]}
    />,
  );
  expect(
    screen.getByRole("link", { name: "View Body front photograph" }),
  ).toHaveAttribute("href", "/api/clinic-photos/one");
});
