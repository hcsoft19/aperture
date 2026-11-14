import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RecommendationList } from "@/features/photo-intelligence/recommendations/recommendation-list";
import { recommend } from "@/features/photo-intelligence/recommendations/recommend";
import { FREE_MODELS } from "@/lib/openrouter/complete";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("recommend", () => {
  it("returns heuristic tips and does not call fetch when no API key is set", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("OPENROUTER_FALLBACK_MODEL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await recommend({ status: "poor", warnings: ["blur", "face_missing"] });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      available: true,
      source: "heuristic",
      model: null,
      items: [
        { code: "face_missing", text: "Move the face into the guide." },
        { code: "blur", text: "Hold still. The image looks soft." },
      ],
    });
  });

  it("uses the second model when the first returns 503 and the reply has two lines", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_FALLBACK_MODEL", "");
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const model = modelFrom(init);
      if (model === FREE_MODELS[0]) {
        return new Response(JSON.stringify({ choices: [{ message: { content: "Ignore this." } }] }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "Bring the face into the frame.\nKeep the camera still until the image is sharp." } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await recommend({ status: "poor", warnings: ["blur", "face_missing", "patient-123"] });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      available: true,
      source: "openrouter",
      model: FREE_MODELS[1],
      items: [
        { code: "face_missing", text: "Bring the face into the frame." },
        { code: "blur", text: "Keep the camera still until the image is sharp." },
      ],
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(ENDPOINT);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(ENDPOINT);
    expect(userText(fetchMock.mock.calls[0]?.[1])).toBe("face_missing, blur");
    expect(modelFrom(fetchMock.mock.calls[1]?.[1])).toBe(FREE_MODELS[1]);
  });

  it("returns no guidance when the photograph status is unavailable", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(recommend({ status: "unavailable", warnings: ["blur", "face_missing"] })).resolves.toEqual({
      available: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns no guidance when the only warning is detector_unavailable", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(recommend({ status: "poor", warnings: ["detector_unavailable"] })).resolves.toEqual({
      available: false,
    });
    await expect(recommend({ status: "good", warnings: [] })).resolves.toEqual({ available: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the fixed sentences when the model reply cannot be split into one line per code", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_FALLBACK_MODEL", "");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse("One line.\nSecond line.\nThird line.")),
    );

    const result = await recommend({ status: "warning", warnings: ["exposure_dark", "unstable"] });

    expect(result).toEqual({
      available: true,
      source: "heuristic",
      model: null,
      items: [
        { code: "unstable", text: "Hold the camera steady." },
        { code: "exposure_dark", text: "Add light. The image looks dark." },
      ],
    });
  });

  it("puts an unsplittable reply on the first tip and keeps the other fixed sentences", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_FALLBACK_MODEL", "");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse("Center the face and hold the camera steady.")),
    );

    const result = await recommend({ status: "warning", warnings: ["unstable", "face_off_center"] });

    expect(result).toEqual({
      available: true,
      source: "openrouter",
      model: FREE_MODELS[0],
      items: [
        { code: "face_off_center", text: "Center the face and hold the camera steady." },
        { code: "unstable", text: "Hold the camera steady." },
      ],
    });
  });

  it("drops model wording that diagnoses, predicts an outcome, or identifies someone", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_FALLBACK_MODEL", "");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse("This diagnosis shows a better outcome.")),
    );

    const result = await recommend({ status: "poor", warnings: ["blur"] });

    expect(result).toEqual({
      available: true,
      source: "heuristic",
      model: null,
      items: [{ code: "blur", text: "Hold still. The image looks soft." }],
    });
  });
});

describe("RecommendationList", () => {
  it("says guidance is unavailable", () => {
    render(createElement(RecommendationList, { recommendation: { available: false } }));

    const heading = screen.getByRole("heading", { name: "Setup suggestions" });
    expect(heading.tagName).toBe("H2");
    expect(heading.className).toContain("text-base");
    expect(screen.getByText("Guidance is unavailable for this photograph.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("lists the setup tips", () => {
    render(
      createElement(RecommendationList, {
        recommendation: {
          available: true,
          source: "heuristic",
          model: null,
          items: [
            { code: "face_missing", text: "Move the face into the guide." },
            { code: "blur", text: "Hold still. The image looks soft." },
          ],
        },
      }),
    );

    expect(screen.getByRole("heading", { name: "Setup suggestions" })).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Move the face into the guide.",
      "Hold still. The image looks soft.",
    ]);
  });
});

function jsonResponse(content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function modelFrom(init: RequestInit | undefined) {
  const body = bodyFrom(init);
  return typeof body.model === "string" ? body.model : "";
}

function userText(init: RequestInit | undefined) {
  const body = bodyFrom(init);
  const messages = body.messages;
  if (!Array.isArray(messages)) {
    return "";
  }
  const user = messages.find((message) => isRecord(message) && message.role === "user");
  return isRecord(user) && typeof user.content === "string" ? user.content : "";
}

function bodyFrom(init: RequestInit | undefined): Record<string, unknown> {
  if (init === undefined || typeof init.body !== "string") {
    throw new Error("Expected a JSON request body.");
  }
  const parsed: unknown = JSON.parse(init.body);
  if (!isRecord(parsed)) {
    throw new Error("Expected an object body.");
  }
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
