import { afterEach, describe, expect, it, vi } from "vitest";

import { assertTextOnly, completeWithFallback, FREE_MODELS } from "@/lib/openrouter/complete";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const REFERER = "https://aperture-hcsoft19-gmailcoms-projects.vercel.app";
const SYSTEM = "Rewrite these photography setup codes as short setup tips.";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("completeWithFallback", () => {
  it("returns unconfigured and does not call fetch when the API key is missing", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("OPENROUTER_FALLBACK_MODEL", "paid/model");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(completeWithFallback({ system: SYSTEM, user: "blur" })).resolves.toEqual({
      ok: false,
      reason: "unconfigured",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tries the free models in order and stops at the first reply", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_FALLBACK_MODEL", "paid/model");
    const seen: string[] = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const model = modelFrom(init);
      seen.push(model);
      if (model === FREE_MODELS[0]) {
        return new Response(JSON.stringify({ choices: [{ message: { content: "Do not use a 503 body." } }] }), {
          status: 503,
        });
      }
      if (model === FREE_MODELS[1]) {
        return jsonResponse("Line one.\nLine two.");
      }
      return new Response("unexpected", { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await completeWithFallback({ system: SYSTEM, user: "face_missing, blur" });

    expect(result).toEqual({ ok: true, text: "Line one.\nLine two.", model: FREE_MODELS[1] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(seen).toEqual([FREE_MODELS[0], FREE_MODELS[1]]);
    const init = fetchMock.mock.calls[1]?.[1];
    expect(init?.method).toBe("POST");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(header(init, "Authorization")).toBe("Bearer test-key");
    expect(header(init, "Content-Type")).toBe("application/json");
    expect(header(init, "HTTP-Referer")).toBe(REFERER);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(ENDPOINT);
    expect(bodyFrom(init)).toEqual({
      model: FREE_MODELS[1],
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: "face_missing, blur" },
      ],
      max_tokens: 180,
      temperature: 0.2,
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("test-key");
    expect(JSON.stringify(error.mock.calls)).not.toContain("test-key");
  });

  it("rejects image data in the user string before fetch", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      completeWithFallback({
        system: SYSTEM,
        user: "look at data:image/jpeg;base64,aaaa",
      }),
    ).rejects.toThrow("Photographs cannot be sent to a language model.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a base64-looking run before fetch", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(() => assertTextOnly("A".repeat(199))).not.toThrow();
    expect(() => assertTextOnly("A".repeat(200))).toThrow("Photographs cannot be sent to a language model.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips an empty reply and uses the fallback model after the free models fail", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_FALLBACK_MODEL", " google/gemini-2.0-flash-001 ");
    const seen: string[] = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const model = modelFrom(init);
      seen.push(model);
      if (model === FREE_MODELS[0]) {
        return jsonResponse("   ");
      }
      if (model === FREE_MODELS[1]) {
        return jsonResponseArray();
      }
      if (model === FREE_MODELS[2]) {
        return new Response("down", { status: 502 });
      }
      if (model === "google/gemini-2.0-flash-001") {
        return jsonResponse("Hold the camera steady.");
      }
      return new Response("unexpected", { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await completeWithFallback({ system: SYSTEM, user: "unstable" });

    expect(result).toEqual({
      ok: true,
      text: "Hold the camera steady.",
      model: "google/gemini-2.0-flash-001",
    });
    expect(seen).toEqual([...FREE_MODELS, "google/gemini-2.0-flash-001"]);
  });

  it("returns unavailable when every model fails", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.stubEnv("OPENROUTER_FALLBACK_MODEL", "");
    const seen: string[] = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(modelFrom(init));
      return new Response("down", { status: 503 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(completeWithFallback({ system: SYSTEM, user: "blur" })).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(seen).toEqual([...FREE_MODELS]);
  });
});

function jsonResponse(content: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonResponseArray() {
  return new Response(JSON.stringify({ choices: [{ message: { content: [{ type: "text", text: "no" }] } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function modelFrom(init: RequestInit | undefined) {
  const model = bodyFrom(init).model;
  return typeof model === "string" ? model : "";
}

function header(init: RequestInit | undefined, name: string) {
  const headers = init?.headers;
  if (headers === undefined || Array.isArray(headers) || headers instanceof Headers) {
    return undefined;
  }
  return headers[name];
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
