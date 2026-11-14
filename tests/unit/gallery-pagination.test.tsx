import { defaultGalleryFilters } from "@/features/gallery/models";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClinicGallery } from "@/features/gallery/gallery";
import { loadGalleryPage } from "@/features/gallery/actions";
import type { GalleryResult } from "@/features/gallery/models";

vi.mock("@/features/gallery/actions", () => ({ loadGalleryPage: vi.fn() }));
vi.mock("@/features/gallery/result-dialog", () => ({
  ResultDialog: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));
const result: GalleryResult = {
  entryKind: "clinical",
  isPlate: false,
  sourceCredits: [],
  patientGender: null,
  procedure: "",
  product: "",
  uploadedAt: null,
  id: "one",
  createdAt: "2026-11-13T12:00:00Z",
  patientId: "patient",
  patientName: "Demo Patient",
  treatmentId: "treatment",
  treatmentName: "Facial progress",
  bodyArea: "Face",
  category: "Demo",
  notes: null,
  shared: false,
  angleName: "Front",
  before: {
    photoId: "before",
    url: null,
    date: "2026-11-01",
    sessionId: "before-session",
    width: 1200,
    height: 1600,
  },
  after: {
    photoId: "after",
    url: null,
    date: "2026-11-13",
    sessionId: "after-session",
    width: 1200,
    height: 1600,
  },
  alignment: { x: 0, y: 0, rotation: 0, scale: 1, aligned: true },
};
const cursor = {
  createdAt: result.createdAt,
  id: "03c8f330-1038-4209-815e-c650ea3992f4",
};
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
describe("clinic gallery browsing", () => {
  it("appends pages without duplicate cards and preserves the gallery when details close", async () => {
    const user = userEvent.setup();
    vi.mocked(loadGalleryPage).mockResolvedValue({
      ok: true,
      data: {
        items: [
          result,
          { ...result, id: "two", treatmentName: "Second result" },
        ],
        total: 2,
        nextCursor: null,
      },
    });
    render(
      <ClinicGallery
        clinicName="Test clinic"
        initialPage={{ items: [result], total: 2, nextCursor: cursor }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Load more results" }));
    expect(
      await screen.findByRole("button", { name: /View result: Second result/ }),
    ).toBeVisible();
    expect(
      screen.getAllByRole("button", { name: /View result:/ }),
    ).toHaveLength(2);
    expect(loadGalleryPage).toHaveBeenCalledWith({
      ...defaultGalleryFilters,
      cursor,
    });
    await user.click(
      screen.getByRole("button", { name: /View result: Second result/ }),
    );
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(
      screen.getAllByRole("button", { name: /View result:/ }),
    ).toHaveLength(2);
  });
  it("resets the cursor when applying filters and shows a clear empty state", async () => {
    const user = userEvent.setup();
    vi.mocked(loadGalleryPage).mockResolvedValue({
      ok: true,
      data: { items: [], total: 0, nextCursor: null },
    });
    render(
      <ClinicGallery
        clinicName="Test clinic"
        initialPage={{ items: [result], total: 2, nextCursor: cursor }}
      />,
    );
    await user.type(
      screen.getByLabelText("Search treatments or patients"),
      "Missing",
    );
    await user.click(screen.getByText(/More filters/));
    await user.selectOptions(
      screen.getByLabelText("Patient sharing"),
      "shared",
    );
    await user.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(
      await screen.findByText("No results match these filters."),
    ).toBeVisible();
    expect(loadGalleryPage).toHaveBeenCalledWith({
      ...defaultGalleryFilters,
      search: "Missing",
      visibility: "shared",
      cursor: null,
    });
  });
  it("retains loaded cards and offers a retry after pagination failure", async () => {
    const user = userEvent.setup();
    vi.mocked(loadGalleryPage).mockRejectedValue(new Error("offline"));
    render(
      <ClinicGallery
        clinicName="Test clinic"
        initialPage={{ items: [result], total: 2, nextCursor: cursor }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Load more results" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Please try again"),
    );
    expect(
      screen.getByRole("button", { name: /View result: Facial progress/ }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });
});
