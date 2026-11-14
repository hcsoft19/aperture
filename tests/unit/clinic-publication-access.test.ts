import { beforeEach, describe, it, expect, vi } from "vitest";
import {
  saveClinicProfile,
  preparePublication,
  setClinicPublished,
  setResultPublished,
} from "@/features/clinic-showcase/actions";
import { getWorkspace } from "@/features/access/workspace";
import { createClient } from "@/lib/supabase/server";
import { profileValues } from "@/features/clinic-showcase/models";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/access/workspace", () => ({ getWorkspace: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
const profile = { ...profileValues(null, "Demo clinic"), slug: "demo-clinic" };
describe("clinic publication authorization", () => {
  it.each([
    null,
    { kind: "patient", activeMembership: null },
    {
      kind: "staff",
      activeMembership: {
        organizationId: "another-clinic",
        role: "professional",
      },
    },
  ])("rejects non-administrators", async (workspace) => {
    vi.mocked(getWorkspace).mockResolvedValue(
      workspace as Awaited<ReturnType<typeof getWorkspace>>,
    );
    expect((await saveClinicProfile(profile)).ok).toBe(false);
    expect((await setClinicPublished(true)).ok).toBe(false);
    expect(
      (
        await setResultPublished({
          id: "03c8f330-1038-4209-815e-c650ea3992f4",
          published: true,
        })
      ).ok,
    ).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });
  it("derives the target clinic from verified membership", async () => {
    vi.mocked(getWorkspace).mockResolvedValue({
      kind: "staff",
      activeMembership: {
        organizationId: "trusted-clinic",
        role: "clinic_admin",
      },
      user: { id: "actor" },
    } as Awaited<ReturnType<typeof getWorkspace>>);
    const upsert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createClient).mockResolvedValue({
      from: () => ({ upsert }),
    } as unknown as Awaited<ReturnType<typeof createClient>>);
    expect(
      (
        await saveClinicProfile({
          ...profile,
          organization_id: "forged-clinic",
        })
      ).ok,
    ).toBe(true);
    expect(upsert.mock.calls[0][0].organization_id).toBe("trusted-clinic");
    expect(upsert.mock.calls[0][0].booking_url).toBe("");
  });
  it("rejects publication without explicit permission before accessing images", async () => {
    expect((await preparePublication({ confirmPermission: false })).ok).toBe(
      false,
    );
    expect(createClient).not.toHaveBeenCalled();
  });
});
