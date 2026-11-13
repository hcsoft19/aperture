import { afterEach, describe, expect, it, vi } from "vitest";
import { describePhotograph } from "@/features/capture/media";

function photo() {
  return { type: "image/jpeg", size: 60, arrayBuffer: async () => new ArrayBuffer(60) } as Blob;
}

afterEach(() => vi.unstubAllGlobals());

describe("photograph decoding", () => {
  it("rejects corrupt image bytes without an unhandled rejection", async () => {
    vi.stubGlobal("crypto", { subtle: { digest: async () => new ArrayBuffer(32) } });
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new DOMException("The source image could not be decoded.", "InvalidStateError")));
    await expect(describePhotograph(photo())).resolves.toBeNull();
  });

  it("returns the original dimensions and hash and releases the bitmap", async () => {
    const close = vi.fn();
    vi.stubGlobal("crypto", { subtle: { digest: async () => new ArrayBuffer(32) } });
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 1200, height: 1600, close }));
    await expect(describePhotograph(photo())).resolves.toEqual({ width: 1200, height: 1600, sha256: "0".repeat(64), mimeType: "image/jpeg", fileSizeBytes: 60 });
    expect(close).toHaveBeenCalledOnce();
  });
});
