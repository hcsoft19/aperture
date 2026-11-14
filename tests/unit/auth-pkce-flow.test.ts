import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.hoisted(() => vi.fn());
const createBrowserClient = vi.hoisted(() => vi.fn());
const createServerClient = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    set: () => undefined,
  }),
}));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient,
  createServerClient,
}));

import { GET } from "@/app/auth/callback/route";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

const supabaseUrl = "https://example.supabase.co";
const publishableKey = "publishable-key";

describe("PKCE flow id", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", publishableKey);
    exchangeCodeForSession.mockReset();
    exchangeCodeForSession.mockResolvedValue({ error: null });
    createBrowserClient.mockReset();
    createBrowserClient.mockReturnValue({ auth: {} });
    createServerClient.mockReset();
    createServerClient.mockReturnValue({
      auth: { exchangeCodeForSession },
    });
  });

  it("appends the flow id from the browser client", () => {
    createBrowserSupabaseClient();

    expect(createBrowserClient).toHaveBeenCalledWith(supabaseUrl, publishableKey, {
      auth: {
        experimental: {
          appendPkceFlowIdToRedirects: true,
        },
      },
    });
  });

  it("appends the flow id from the server client that starts auth", async () => {
    await createServerSupabaseClient();

    expect(createServerClient).toHaveBeenCalledWith(
      supabaseUrl,
      publishableKey,
      expect.objectContaining({
        auth: {
          experimental: {
            appendPkceFlowIdToRedirects: true,
          },
        },
      }),
    );
  });

  it("exchanges the verifier for the flow id on the callback", async () => {
    const response = await GET(
      new Request(
        "https://example.test/auth/callback?code=auth-code&sb_flow_id=flow-123&next=/reset-password",
      ),
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith("auth-code", {
      flowId: "flow-123",
    });
    expect(response.headers.get("location")).toBe("https://example.test/reset-password");
  });

  it("exchanges the newest verifier when the link has no flow id", async () => {
    await GET(new Request("https://example.test/auth/callback?code=auth-code"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("auth-code", undefined);
  });

  it("keeps the plain auth error when the exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({
      error: { message: "code verifier not found" },
    });

    const response = await GET(
      new Request(
        "https://example.test/auth/callback?code=auth-code&sb_flow_id=flow-123",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "https://example.test/login?error=auth",
    );
  });

  it("keeps the plain auth error when the code is missing", async () => {
    const response = await GET(
      new Request("https://example.test/auth/callback?sb_flow_id=flow-123"),
    );

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://example.test/login?error=auth",
    );
  });
});
