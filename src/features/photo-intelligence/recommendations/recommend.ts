import { assertTextOnly, completeWithFallback } from "@/lib/openrouter/complete";

const SETUP_TIPS = [
  { code: "face_missing", text: "Move the face into the guide." },
  { code: "face_too_small", text: "Move closer so the face fills the guide." },
  { code: "face_too_large", text: "Move back so the whole face fits the guide." },
  { code: "face_off_center", text: "Center the face in the guide." },
  { code: "pose_mismatch", text: "Turn to match this angle, then center the face in the guide." },
  { code: "blur", text: "Hold still. The image looks soft." },
  { code: "unstable", text: "Hold the camera steady." },
  { code: "exposure_dark", text: "Add light. The image looks dark." },
  { code: "exposure_bright", text: "Reduce the light. The image looks bright." },
  { code: "baseline_mismatch", text: "Match the baseline framing." },
] as const;

const SYSTEM_PROMPT =
  "Rewrite these photography setup codes as short setup tips. Do not diagnose, score a treatment, identify a person, or invent a result. One sentence per code.";

const BLOCKED_WORDING = /diagnos|cancer|outcome|identit/i;

export type RecommendationItem = {
  code: string;
  text: string;
};

export type RecommendationResult =
  | { available: false }
  | {
      available: true;
      source: "heuristic" | "openrouter";
      model: string | null;
      items: RecommendationItem[];
    };

type Completion = Awaited<ReturnType<typeof completeWithFallback>>;

export async function recommend(input: {
  status: "good" | "warning" | "poor" | "unavailable";
  warnings: string[];
}): Promise<RecommendationResult> {
  if (input.status === "unavailable") {
    return { available: false };
  }

  const items = heuristicItems(input.warnings);
  if (items.length === 0) {
    return { available: false };
  }

  const heuristic: RecommendationResult = { available: true, source: "heuristic", model: null, items };
  let completion: Completion;
  try {
    completion = await completeWithFallback({
      system: SYSTEM_PROMPT,
      user: items.map((item) => item.code).join(", "),
    });
  } catch {
    return heuristic;
  }

  return wordingFromModel(heuristic, completion);
}

function heuristicItems(warnings: readonly string[]): RecommendationItem[] {
  const present = new Set(warnings);
  return SETUP_TIPS.filter((tip) => present.has(tip.code)).map((tip) => ({
    code: tip.code,
    text: tip.text,
  }));
}

function wordingFromModel(heuristic: Extract<RecommendationResult, { available: true }>, completion: Completion): RecommendationResult {
  if (!completion.ok || BLOCKED_WORDING.test(completion.text)) {
    return heuristic;
  }

  try {
    assertTextOnly(completion.text);
  } catch {
    return heuristic;
  }

  const lines = completion.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length !== heuristic.items.length) {
    if (lines.length === 1 && heuristic.items.length > 1) {
      const paragraph = lines[0];
      if (paragraph === undefined) {
        return heuristic;
      }
      return {
        available: true,
        source: "openrouter",
        model: completion.model,
        items: heuristic.items.map((item, index) => ({
          code: item.code,
          text: index === 0 ? paragraph : item.text,
        })),
      };
    }
    return heuristic;
  }

  const items: RecommendationItem[] = [];
  for (let index = 0; index < heuristic.items.length; index += 1) {
    const item = heuristic.items[index];
    const text = lines[index];
    if (item === undefined || text === undefined) {
      return heuristic;
    }
    items.push({ code: item.code, text });
  }

  return { available: true, source: "openrouter", model: completion.model, items };
}
