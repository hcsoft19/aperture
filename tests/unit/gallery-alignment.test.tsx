import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { galleryAlignment, type GalleryResult } from "@/features/gallery/models";
import { ResultView } from "@/features/gallery/result-view";

vi.mock("next/image", () => ({
  default: ({
    alt,
    style,
  }: {
    alt: string;
    style?: { transform?: string };
  }) => <span role="img" aria-label={alt} style={style} />,
}));

const saved = {
  x: 4,
  y: -2,
  rotation: 3,
  scale: 1.2,
  aligned: true,
  layout: "slider" as const,
  syncFraming: true,
  beforeZoom: 1.4,
  afterZoom: 1.5,
};
const beforeTransform = "scale(1.4)";
const afterTransform = "translate(4%, -2%) rotate(3deg) scale(1.8)";

function comparison(alignment: GalleryResult["alignment"]): GalleryResult {
  return {
    id: "result-1",
    createdAt: "2026-11-13T12:00:00Z",
    entryKind: "clinical",
    isPlate: false,
    sourceCredits: [],
    patientId: "patient",
    patientName: "Demo Patient",
    patientGender: null,
    treatmentId: "treatment",
    treatmentName: "Facial progress",
    bodyArea: "Face",
    category: "Demo",
    procedure: "",
    product: "",
    notes: null,
    uploadedAt: null,
    shared: false,
    angleName: "Front",
    before: {
      photoId: "before",
      url: "/before.jpg",
      sessionId: "before-session",
      date: "2026-11-01T00:00:00Z",
      width: 1200,
      height: 1600,
    },
    after: {
      photoId: "after",
      url: "/after.jpg",
      sessionId: "after-session",
      date: "2026-11-13T00:00:00Z",
      width: 1200,
      height: 1600,
    },
    alignment,
  };
}

afterEach(cleanup);

describe("gallery alignment", () => {
  it("keeps layout, framing, and zoom stored with the alignment", () => {
    expect(
      galleryAlignment({
        ...saved,
        beforeRevisionId: "revision-before",
        afterRevisionId: "revision-after",
      }),
    ).toEqual(saved);
  });

  it("fills layout and zoom when an older alignment omitted them", () => {
    expect(
      galleryAlignment({ x: 1, y: 2, rotation: 0, scale: 1, aligned: false }),
    ).toEqual({
      x: 1,
      y: 2,
      rotation: 0,
      scale: 1,
      aligned: false,
      layout: "side_by_side",
      syncFraming: false,
      beforeZoom: 1,
      afterZoom: 1,
    });
  });

  it("drops an alignment whose offset is outside the saved range", () => {
    expect(
      galleryAlignment({ ...saved, x: 80 }),
    ).toEqual({
      x: 0,
      y: 0,
      rotation: 0,
      scale: 1,
      aligned: false,
      layout: "side_by_side",
      syncFraming: false,
      beforeZoom: 1,
      afterZoom: 1,
    });
  });
});

describe("gallery comparison view", () => {
  it("opens in the saved slider or stacked layout and applies zoom in every mode", async () => {
    const user = userEvent.setup();
    render(<ResultView result={comparison(saved)} />);
    expect(
      screen.getByRole("button", { name: "Compare slider" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("img", { name: "Before: Front" })).toHaveStyle({
      transform: beforeTransform,
    });
    expect(screen.getByRole("img", { name: "After: Front" })).toHaveStyle({
      transform: afterTransform,
    });

    await user.click(screen.getByRole("button", { name: "Side by side" }));
    expect(screen.getByRole("img", { name: "Before: Front" })).toHaveStyle({
      transform: beforeTransform,
    });
    expect(screen.getByRole("img", { name: "After: Front" })).toHaveStyle({
      transform: afterTransform,
    });
    const pair = screen.getByRole("img", { name: "Before: Front" }).closest(".grid");
    expect(pair).toHaveClass("grid-cols-1", "sm:grid-cols-2", "max-w-full", "overflow-hidden");
    expect(pair).not.toHaveClass("grid-cols-2");

    await user.click(screen.getByRole("button", { name: "Stacked" }));
    expect(screen.getByRole("img", { name: "Before: Front" })).toHaveStyle({
      transform: beforeTransform,
    });
    expect(screen.getByRole("img", { name: "After: Front" })).toHaveStyle({
      transform: afterTransform,
    });
  });

  it("keeps side by side when that layout was saved", () => {
    render(
      <ResultView result={comparison({ ...saved, layout: "side_by_side" })} />,
    );
    expect(screen.getByRole("button", { name: "Side by side" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("opens stacked when that layout was saved", () => {
    render(<ResultView result={comparison({ ...saved, layout: "stack" })} />);
    expect(screen.getByRole("button", { name: "Stacked" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("img", { name: "Before: Front" })).toHaveStyle({
      transform: beforeTransform,
    });
  });

  it("hides a corner label when the wipe covers that photograph", () => {
    render(<ResultView result={comparison(saved)} />);
    expect(screen.getByText("After").className).toContain("left-3");
    expect(screen.getByText("Before").className).toContain("right-3");

    fireEvent.change(screen.getByRole("slider", { name: "Compare before and after" }), {
      target: { value: "0" },
    });
    expect(screen.queryByText("After")).not.toBeInTheDocument();
    expect(screen.getByText("Before")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("slider", { name: "Compare before and after" }), {
      target: { value: "100" },
    });
    expect(screen.queryByText("Before")).not.toBeInTheDocument();
    expect(screen.getByText("After")).toBeInTheDocument();
  });
});
