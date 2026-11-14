import { describe, expect, it } from "vitest";

import { ALIGNMENT_VERSION, suggestAlignment, type Geometry } from "@/features/photo-intelligence/alignment/suggest";

const baseline: Geometry = { centerX: 0.5, centerY: 0.5, width: 1, roll: 0 };
const followUp: Geometry = { centerX: 0.5, centerY: 0.5, width: 1, roll: 0 };

describe("assisted alignment", () => {
  it("refuses a different protocol angle", () => {
    expect(suggestAlignment({ sameAngle: false, baseline, followUp })).toEqual({
      ok: false,
      reason: "different_angle",
    });
    expect(suggestAlignment({ sameAngle: false, baseline: null, followUp: null })).toEqual({
      ok: false,
      reason: "different_angle",
    });
  });

  it("refuses missing geometry", () => {
    expect(suggestAlignment({ sameAngle: true, baseline: null, followUp })).toEqual({
      ok: false,
      reason: "missing_geometry",
    });
    expect(suggestAlignment({ sameAngle: true, baseline, followUp: null })).toEqual({
      ok: false,
      reason: "missing_geometry",
    });

    expect(
      suggestAlignment({
        sameAngle: true,
        baseline: { ...baseline, centerX: Number.NaN },
        followUp,
      }),
    ).toEqual({ ok: false, reason: "missing_geometry" });

    for (const width of [0, -2, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(suggestAlignment({ sameAngle: true, baseline: { ...baseline, width }, followUp })).toEqual({
        ok: false,
        reason: "missing_geometry",
      });
      expect(suggestAlignment({ sameAngle: true, baseline, followUp: { ...followUp, width } })).toEqual({
        ok: false,
        reason: "missing_geometry",
      });
    }
  });

  it("scales the follow-up uniformly from the width ratio", () => {
    const matched = suggestAlignment({
      sameAngle: true,
      baseline: { ...baseline, width: 5 },
      followUp: { ...followUp, width: 4 },
    });
    const enlarged = suggestAlignment({
      sameAngle: true,
      baseline: { ...baseline, width: 3 },
      followUp: { ...followUp, width: 1 },
    });
    const reduced = suggestAlignment({
      sameAngle: true,
      baseline: { ...baseline, width: 1 },
      followUp: { ...followUp, width: 4 },
    });
    const comfortable = suggestAlignment({
      sameAngle: true,
      baseline: { ...baseline, width: 4 },
      followUp: { ...followUp, width: 5 },
    });

    expect(matched).toMatchObject({
      ok: true,
      version: ALIGNMENT_VERSION,
      scale: 1.25,
      confidence: 0.75,
      x: 0,
      y: 0,
    });
    expect(enlarged).toMatchObject({ ok: true, scale: 2, confidence: 0.4 });
    expect(reduced).toMatchObject({ ok: true, scale: 0.5, confidence: 0.4 });
    expect(comfortable).toMatchObject({ ok: true, scale: 0.8, confidence: 0.75 });
    for (const result of [matched, enlarged, reduced, comfortable]) {
      expect(result).not.toHaveProperty("scaleX");
      expect(result).not.toHaveProperty("scaleY");
    }
  });

  it("clamps rotation to fifteen degrees and lowers confidence beyond that", () => {
    const clockwise = suggestAlignment({
      sameAngle: true,
      baseline: { ...baseline, roll: 20 },
      followUp: { ...followUp, roll: 0 },
    });
    const counterclockwise = suggestAlignment({
      sameAngle: true,
      baseline: { ...baseline, roll: 0 },
      followUp: { ...followUp, roll: 20 },
    });
    const atLimit = suggestAlignment({
      sameAngle: true,
      baseline: { ...baseline, roll: 15 },
      followUp: { ...followUp, roll: 0 },
    });
    const unknownRoll = suggestAlignment({
      sameAngle: true,
      baseline: { ...baseline, roll: null },
      followUp: { ...followUp, roll: 4 },
    });

    expect(clockwise).toMatchObject({ ok: true, rotation: 15, confidence: 0.4 });
    expect(counterclockwise).toMatchObject({ ok: true, rotation: -15, confidence: 0.4 });
    expect(atLimit).toMatchObject({ ok: true, rotation: 15, confidence: 0.75 });
    expect(unknownRoll).toMatchObject({ ok: true, rotation: -4, confidence: 0.4 });
  });

  it("translates the follow-up from its center minus the baseline center", () => {
    const shifted = suggestAlignment({
      sameAngle: true,
      baseline: { ...baseline, centerX: 0.25, centerY: 0.5 },
      followUp: { ...followUp, centerX: 0.5, centerY: 0.25 },
    });
    const opposite = suggestAlignment({
      sameAngle: true,
      baseline: { ...baseline, centerX: 0.5, centerY: 0.25 },
      followUp: { ...followUp, centerX: 0.25, centerY: 0.5 },
    });
    const clamped = suggestAlignment({
      sameAngle: true,
      baseline: { ...baseline, centerX: 0, centerY: 1 },
      followUp: { ...followUp, centerX: 1, centerY: 0 },
    });

    expect(shifted).toMatchObject({ ok: true, x: 25, y: -25, scale: 1, rotation: 0, confidence: 0.75 });
    expect(opposite).toMatchObject({ ok: true, x: -25, y: 25 });
    expect(clamped).toMatchObject({ ok: true, x: 50, y: -50 });
  });
});
