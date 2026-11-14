import { defaultGalleryFilters } from "@/features/gallery/models";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadGalleryPage, loadGalleryResult } from "@/features/gallery/actions";
import { getWorkspace } from "@/features/access/workspace";
import { getClinicResult, listClinicResults } from "@/features/gallery/queries";

vi.mock("@/features/access/workspace", () => ({ getWorkspace: vi.fn() }));
vi.mock("@/features/gallery/queries", () => ({
  getClinicResult: vi.fn(),
  listClinicResults: vi.fn(),
}));

const resultId = "03c8f330-1038-4209-815e-c650ea3992f4";
beforeEach(() => vi.resetAllMocks());
function workspace(kind: "staff" | "patient" | "needs_clinic") {
  vi.mocked(getWorkspace).mockResolvedValue({
    kind,
    activeMembership:
      kind === "staff"
        ? {
            organizationId: "trusted-clinic",
            organizationName: "Clinic",
            role: "professional",
          }
        : null,
  } as Awaited<ReturnType<typeof getWorkspace>>);
}

describe("private clinic gallery actions", () => {
  it.each(["patient", "needs_clinic"] as const)(
    "rejects %s access before reading comparisons",
    async (kind) => {
      workspace(kind);
      expect((await loadGalleryPage({})).ok).toBe(false);
      expect((await loadGalleryResult(resultId)).ok).toBe(false);
      expect(listClinicResults).not.toHaveBeenCalled();
      expect(getClinicResult).not.toHaveBeenCalled();
    },
  );
  it("rejects anonymous callers", async () => {
    vi.mocked(getWorkspace).mockResolvedValue(null);
    expect((await loadGalleryPage({})).ok).toBe(false);
    expect(listClinicResults).not.toHaveBeenCalled();
  });
  it("uses the verified clinic and ignores a caller-supplied organization", async () => {
    workspace("staff");
    vi.mocked(listClinicResults).mockResolvedValue({
      items: [],
      total: 0,
      nextCursor: null,
    });
    expect(
      (await loadGalleryPage({ organizationId: "another-clinic" })).ok,
    ).toBe(true);
    expect(listClinicResults).toHaveBeenCalledWith("trusted-clinic", {
      ...defaultGalleryFilters,
      cursor: null,
    });
  });
  it("rejects filter injection through a forged cursor before querying", async () => {
    workspace("staff");
    expect(
      (
        await loadGalleryPage({
          cursor: { id: "x),id.neq.null", createdAt: "2026-11-13" },
        })
      ).ok,
    ).toBe(false);
    expect(listClinicResults).not.toHaveBeenCalled();
  });
  it("keeps unavailable results and internal errors out of the response", async () => {
    workspace("staff");
    vi.mocked(getClinicResult).mockResolvedValue(null);
    expect(await loadGalleryResult(resultId)).toEqual({
      ok: false,
      message: "This result is not available.",
    });
    expect(getClinicResult).toHaveBeenCalledWith("trusted-clinic", resultId);
    vi.mocked(listClinicResults).mockRejectedValue(
      new Error("private database details"),
    );
    expect(JSON.stringify(await loadGalleryPage({}))).not.toContain(
      "database details",
    );
  });
});
