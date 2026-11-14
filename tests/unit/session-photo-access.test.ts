import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { GET } from "@/app/api/clinic-photos/[photoId]/route";
import { getWorkspace } from "@/features/access/workspace";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/features/access/workspace", () => ({ getWorkspace: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
const photoId = "10000000-0000-4000-8000-000000000012";
const request = () =>
  GET(new Request("https://example.com/api/gallery/photos/" + photoId), {
    params: Promise.resolve({ photoId }),
  });
beforeEach(() => vi.resetAllMocks());
function staff() {
  vi.mocked(getWorkspace).mockResolvedValue({
    kind: "staff",
    activeMembership: { organizationId: "clinic-a", role: "professional" },
  } as Awaited<ReturnType<typeof getWorkspace>>);
}
function client(photo: unknown, bytes?: Uint8Array) {
  const download = vi.fn().mockResolvedValue({
    data: bytes ? new Blob([bytes as Uint8Array<ArrayBuffer>]) : null,
    error: null,
  });
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: photo, error: null }),
  };
  vi.mocked(createClient).mockResolvedValue({
    from: () => query,
    storage: { from: () => ({ download }) },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { query, download };
}
describe("private gallery thumbnails", () => {
  it("denies patients and anonymous callers without reading Storage", async () => {
    vi.mocked(getWorkspace).mockResolvedValue(null);
    expect((await request()).status).toBe(403);
    vi.mocked(getWorkspace).mockResolvedValue({
      kind: "patient",
      activeMembership: null,
    } as Awaited<ReturnType<typeof getWorkspace>>);
    expect((await request()).status).toBe(403);
    expect(createClient).not.toHaveBeenCalled();
  });
  it("does not download an inaccessible clinic photo", async () => {
    staff();
    const { query, download } = client(null);
    expect((await request()).status).toBe(404);
    expect(query.eq).toHaveBeenCalledWith(
      "photo_sessions.treatments.patients.organization_id",
      "clinic-a",
    );
    expect(download).not.toHaveBeenCalled();
  });
  it("returns a small non-cacheable derivative and never replaces the original", async () => {
    staff();
    const original = await sharp({
      create: { width: 1200, height: 1600, channels: 3, background: "#d6b8ba" },
    })
      .jpeg()
      .toBuffer();
    const { download } = client(
      { storage_path: "clinic-a/original.jpg" },
      original,
    );
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    const metadata = await sharp(
      Buffer.from(await response.arrayBuffer()),
    ).metadata();
    expect(metadata.width).toBe(750);
    expect(metadata.height).toBe(1000);
    expect(download).toHaveBeenCalledWith("clinic-a/original.jpg");
  });
});
