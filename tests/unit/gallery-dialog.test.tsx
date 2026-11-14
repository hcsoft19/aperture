import { StrictMode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ResultDialog } from "@/features/gallery/result-dialog";
vi.mock("@/features/gallery/actions", () => ({
  loadGalleryResult: vi
    .fn()
    .mockResolvedValue({ ok: false, message: "This result is not available." }),
}));
afterEach(cleanup);
it("keeps details open through Strict Mode effect replay and closes explicitly", async () => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    },
  });
  const onClose = vi.fn();
  render(
    <StrictMode>
      <ResultDialog
        resultId="03c8f330-1038-4209-815e-c650ea3992f4"
        onClose={onClose}
      />
    </StrictMode>,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("not available");
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(onClose).not.toHaveBeenCalled();
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Close" }));
  expect(onClose).toHaveBeenCalledOnce();
  vi.restoreAllMocks();
});
