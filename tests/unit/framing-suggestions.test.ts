import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FramingSuggestion } from "@/features/photo-intelligence/framing/framing-suggestion";
import {
  FRAMING_VERSION,
  suggestFraming,
  type FramingCrop,
} from "@/features/photo-intelligence/framing/suggest";

function expectInsidePhotograph(crop: FramingCrop) {
  expect(crop.aspect).toBe("free");
  expect(crop.x).toBeGreaterThanOrEqual(0);
  expect(crop.y).toBeGreaterThanOrEqual(0);
  expect(crop.width).toBeGreaterThan(0);
  expect(crop.height).toBeGreaterThan(0);
  expect(crop.width).toBeLessThanOrEqual(1);
  expect(crop.height).toBeLessThanOrEqual(1);
  expect(crop.x + crop.width).toBeLessThanOrEqual(1);
  expect(crop.y + crop.height).toBeLessThanOrEqual(1);
}

describe("suggestFraming", () => {
  it("returns no_face when there is no face", () => {
    expect(suggestFraming(null)).toEqual({ ok: false, reason: "no_face" });
  });

  it("returns no_face when the face width is zero", () => {
    expect(suggestFraming({ centerX: 0.5, centerY: 0.5, width: 0, height: 0.4 })).toEqual({
      ok: false,
      reason: "no_face",
    });
    expect(suggestFraming({ centerX: 0.5, centerY: 0.5, width: 0.4, height: 0 })).toEqual({
      ok: false,
      reason: "no_face",
    });
    expect(suggestFraming({ centerX: 0.5, centerY: 0.5, width: Number.NaN, height: 0.4 })).toEqual({
      ok: false,
      reason: "no_face",
    });
  });

  it("keeps an off-center face inside the frame", () => {
    const suggestion = suggestFraming({ centerX: 0.08, centerY: 0.92, width: 0.36, height: 0.42 });

    expect(suggestion.ok).toBe(true);
    if (!suggestion.ok) {
      return;
    }

    expectInsidePhotograph(suggestion.crop);
    expect(suggestion.crop.x).toBe(0);
    expect(suggestion.crop.y + suggestion.crop.height).toBeCloseTo(1, 10);
    expect(suggestion.crop.x).toBeLessThanOrEqual(0.08);
    expect(suggestion.crop.x + suggestion.crop.width).toBeGreaterThanOrEqual(0.08);
    expect(suggestion.crop.y).toBeLessThanOrEqual(0.92);
    expect(suggestion.crop.y + suggestion.crop.height).toBeGreaterThanOrEqual(0.92);
  });

  it("lowers confidence when the face is unusually small or large", () => {
    const small = suggestFraming({ centerX: 0.5, centerY: 0.5, width: 0.1, height: 0.2 });
    const large = suggestFraming({ centerX: 0.5, centerY: 0.5, width: 0.8, height: 0.7 });

    expect(small.ok && small.confidence).toBe(0.45);
    expect(large.ok && large.confidence).toBe(0.45);
    if (small.ok) expectInsidePhotograph(small.crop);
    if (large.ok) expectInsidePhotograph(large.crop);
  });

  it("contains the center of a centered face of width 0.4", () => {
    const suggestion = suggestFraming({ centerX: 0.5, centerY: 0.5, width: 0.4, height: 0.5 });

    expect(suggestion.ok).toBe(true);
    if (!suggestion.ok) {
      return;
    }

    expect(suggestion.version).toBe(FRAMING_VERSION);
    expect(suggestion.confidence).toBe(0.8);
    expectInsidePhotograph(suggestion.crop);
    expect(suggestion.crop.width).toBeCloseTo(0.4 / 0.45, 10);
    expect(suggestion.crop.x).toBeLessThanOrEqual(0.5);
    expect(suggestion.crop.x + suggestion.crop.width).toBeGreaterThanOrEqual(0.5);
    expect(suggestion.crop.y).toBeLessThanOrEqual(0.5);
    expect(suggestion.crop.y + suggestion.crop.height).toBeGreaterThanOrEqual(0.5);
    expect(suggestion.crop.x).toBeCloseTo(0.5 - suggestion.crop.width / 2, 10);
    expect(suggestion.crop.y).toBeCloseTo(0.5 - suggestion.crop.height / 2, 10);
  });
});

describe("FramingSuggestion", () => {
  it("explains when a suggestion is not available", () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    render(
      createElement(FramingSuggestion, {
        suggestion: { ok: false, reason: "no_face" },
        onAccept,
        onReject,
      }),
    );

    expect(screen.getByText("A framing suggestion is not available for this photograph.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(onAccept).not.toHaveBeenCalled();
    expect(onReject).not.toHaveBeenCalled();
  });

  it("asks before using a suggestion and leaves the photograph unchanged", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    const onReject = vi.fn();
    const suggestion = suggestFraming({ centerX: 0.5, centerY: 0.5, width: 0.4, height: 0.5 });
    render(createElement(FramingSuggestion, { suggestion, onAccept, onReject }));

    expect(screen.getByText("Suggested framing. The original photograph stays unchanged.")).toBeInTheDocument();
    expect(onAccept).not.toHaveBeenCalled();
    const accept = screen.getByRole("button", { name: "Use suggested framing" });
    const reject = screen.getByRole("button", { name: "Keep current framing" });
    expect(accept).toHaveAttribute("type", "button");
    expect(reject).toHaveAttribute("type", "button");
    expect(accept.className).toContain("min-h-11");
    expect(reject.className).toContain("min-h-11");

    await user.click(accept);
    expect(onAccept).toHaveBeenCalledTimes(1);
    if (suggestion.ok) {
      expect(onAccept).toHaveBeenCalledWith(suggestion.crop);
    }
    expect(onReject).not.toHaveBeenCalled();

    await user.click(reject);
    expect(onReject).toHaveBeenCalledTimes(1);
  });
});
