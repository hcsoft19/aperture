export const FREE_MODELS = [
  "openrouter/free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "qwen/qwen-2.5-7b-instruct:free",
] as const;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_REFERER = "https://aperture-hcsoft19-gmailcoms-projects.vercel.app";
const BASE64_RUN = /[A-Za-z0-9+/]{200,}={0,2}/;

export function assertTextOnly(text: string): void {
  if (text.toLowerCase().includes("data:image") || BASE64_RUN.test(text)) {
    throw new Error("Photographs cannot be sent to a language model.");
  }
}

export async function completeWithFallback(input: {
  system: string;
  user: string;
}): Promise<{ ok: true; text: string; model: string } | { ok: false; reason: "unconfigured" | "unavailable" }> {
  assertTextOnly(input.system);
  assertTextOnly(input.user);

  const apiKey = process.env.OPENROUTER_API_KEY?.trim() ?? "";
  if (apiKey === "") {
    return { ok: false, reason: "unconfigured" };
  }

  for (const model of modelsToTry()) {
    const text = await requestCompletion(apiKey, model, input.system, input.user);
    if (text !== null) {
      return { ok: true, text, model };
    }
  }

  return { ok: false, reason: "unavailable" };
}

function modelsToTry(): string[] {
  const models: string[] = [...FREE_MODELS];
  const fallback = process.env.OPENROUTER_FALLBACK_MODEL?.trim() ?? "";
  if (fallback !== "") {
    models.push(fallback);
  }
  return models;
}

async function requestCompletion(apiKey: string, model: string, system: string, user: string): Promise<string | null> {
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": OPENROUTER_REFERER,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 180,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return null;
    }
    const body: unknown = await response.json();
    return readContent(body);
  } catch {
    return null;
  }
}

function readContent(value: unknown): string | null {
  if (!isRecord(value) || !Array.isArray(value.choices) || value.choices.length === 0) {
    return null;
  }
  const choice: unknown = value.choices[0];
  if (!isRecord(choice) || !isRecord(choice.message)) {
    return null;
  }
  const content = choice.message.content;
  if (typeof content !== "string") {
    return null;
  }
  const text = content.trim();
  return text.length > 0 ? text : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
