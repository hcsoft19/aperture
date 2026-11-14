import { afterEach, describe, expect, it, vi } from "vitest";
import { describePhotograph, jpegFromDecodedBitmap } from "@/features/capture/media";

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

  it("keeps JPEG, PNG, and WebP on the existing save path", async () => {
    const close = vi.fn();
    vi.stubGlobal("crypto", { subtle: { digest: async () => new ArrayBuffer(32) } });
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 1000, height: 1400, close }));
    for (const type of ["image/jpeg", "image/png", "image/webp"] as const) {
      const file = { type, size: 80, arrayBuffer: async () => new ArrayBuffer(80) } as Blob;
      await expect(describePhotograph(file)).resolves.toMatchObject({ mimeType: type, width: 1000, height: 1400, fileSizeBytes: 80 });
    }
  });

  it("still refuses an empty type until it has been re-encoded", async () => {
    const decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);
    const file = { type: "", size: 80, arrayBuffer: async () => new ArrayBuffer(80) } as Blob;
    await expect(describePhotograph(file)).resolves.toBeNull();
    expect(decode).not.toHaveBeenCalled();
  });
});

describe("untyped photographs", () => {
  it("re-encodes a bitmap the browser can decode as JPEG", async () => {
    const close = vi.fn();
    const drawImage = vi.fn();
    const bitmap = { width: 1200, height: 1600, close };
    const jpeg = new Blob([Uint8Array.from([9, 8, 7])], { type: "image/jpeg" });
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    const toBlob = vi.fn((callback: BlobCallback) => {
      callback(jpeg);
    });
    const canvas = document.createElement("canvas");
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(canvas, "getContext").mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    canvas.toBlob = toBlob;
    const create = vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "canvas") {
        return canvas;
      }
      return originalCreate(tagName);
    });

    try {
      const source = new File([Uint8Array.from([1, 2, 3])], "phone", { type: "" });
      await expect(jpegFromDecodedBitmap(source)).resolves.toBe(jpeg);
      expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0);
      expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.92);
      expect(close).toHaveBeenCalledOnce();
    } finally {
      create.mockRestore();
    }
  });

  it("returns nothing when the browser cannot decode the file", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("decode")));
    const source = new File([Uint8Array.from([1])], "phone", { type: "" });
    await expect(jpegFromDecodedBitmap(source)).resolves.toBeNull();
  });

  it("releases the bitmap when the decoded image cannot be encoded", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 1200, height: 1600, close }));
    const canvas = document.createElement("canvas");
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(canvas, "getContext").mockReturnValue(null);
    const create = vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "canvas") {
        return canvas;
      }
      return originalCreate(tagName);
    });

    try {
      await expect(jpegFromDecodedBitmap(new File([Uint8Array.from([1])], "phone", { type: "" }))).resolves.toBeNull();
      expect(close).toHaveBeenCalledOnce();
    } finally {
      create.mockRestore();
    }
  });
});
