import type { EditDocument } from "@/features/editor/schema";

export type PixelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: "#000000" | "#FFFFFF";
};

export type EditLayout = {
  width: number;
  height: number;
  background: string;
  presentationEdited: boolean;
  image: { x: number; y: number; width: number; height: number; rotation: number };
  masks: PixelRect[];
};

const ASPECT: Record<string, number | null> = {
  free: null,
  original: null,
  "1:1": 1,
  "3:4": 3 / 4,
  "4:5": 4 / 5,
  "16:9": 16 / 9,
};

export function rotatedSize(width: number, height: number, degrees: number) {
  const radians = (degrees * Math.PI) / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));
  return {
    width: width * cosine + height * sine,
    height: width * sine + height * cosine,
  };
}

/** Clockwise rotation in screen space, where Y grows downward. */
export function rotatePoint(
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  degrees: number,
) {
  const radians = (degrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const dx = x - centerX;
  const dy = y - centerY;
  return {
    x: centerX + dx * cosine - dy * sine,
    y: centerY + dx * sine + dy * cosine,
  };
}

export function cropForAspect(
  sourceWidth: number,
  sourceHeight: number,
  rotation: number,
  aspect: EditDocument["crop"]["aspect"],
): EditDocument["crop"] {
  if (aspect === "free" || aspect === "original") {
    return { aspect, x: 0, y: 0, width: 1, height: 1 };
  }

  const box = rotatedSize(sourceWidth, sourceHeight, rotation);
  const target = ASPECT[aspect] ?? 1;
  let width = 1;
  let height = box.width / target / box.height;
  if (height > 1) {
    height = 1;
    width = (box.height * target) / box.width;
  }

  return {
    aspect,
    x: (1 - width) / 2,
    y: (1 - height) / 2,
    width,
    height,
  };
}

export function layoutEdit(sourceWidth: number, sourceHeight: number, edit: EditDocument): EditLayout {
  const box = rotatedSize(sourceWidth, sourceHeight, edit.image.rotation);
  const crop = {
    x: edit.crop.x * box.width,
    y: edit.crop.y * box.height,
    width: Math.max(1, edit.crop.width * box.width),
    height: Math.max(1, edit.crop.height * box.height),
  };
  const pad = edit.canvas.padding;
  let width = crop.width + pad * 2;
  let height = crop.height + pad * 2;
  const ratio = ASPECT[edit.canvas.outputAspect];
  if (ratio) {
    const current = width / height;
    if (current > ratio) {
      height = width / ratio;
    } else {
      width = height * ratio;
    }
  }

  const imageX = (width - crop.width) / 2 - crop.x;
  const imageY = (height - crop.height) / 2 - crop.y;
  const centerX = sourceWidth / 2;
  const centerY = sourceHeight / 2;
  const masks = [...edit.privacyMasks]
    .sort((left, right) => left.order - right.order)
    .map((mask) => {
      const sourceX = mask.x * sourceWidth;
      const sourceY = mask.y * sourceHeight;
      const moved = rotatePoint(sourceX, sourceY, centerX, centerY, edit.image.rotation);
      return {
        x: imageX + box.width / 2 + (moved.x - centerX),
        y: imageY + box.height / 2 + (moved.y - centerY),
        width: mask.width * sourceWidth,
        height: mask.height * sourceHeight,
        rotation: mask.rotation + edit.image.rotation,
        fill: mask.fill,
      };
    });
  const full = edit.crop.x === 0 && edit.crop.y === 0 && edit.crop.width === 1 && edit.crop.height === 1;

  return {
    width: Math.round(width),
    height: Math.round(height),
    background: edit.canvas.background === "original" ? "#E6E6E6" : edit.canvas.background,
    presentationEdited:
      !full ||
      edit.image.rotation !== 0 ||
      pad !== 0 ||
      edit.canvas.background !== "original" ||
      masks.length > 0 ||
      edit.backgroundRemoval.enabled,
    image: {
      x: imageX + box.width / 2,
      y: imageY + box.height / 2,
      width: sourceWidth,
      height: sourceHeight,
      rotation: edit.image.rotation,
    },
    masks,
  };
}

export function paintMasks(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  masks: Pick<PixelRect, "x" | "y" | "width" | "height" | "fill">[],
) {
  const output = new Uint8ClampedArray(pixels);
  for (const mask of masks) {
    const fill = mask.fill === "#FFFFFF" ? [255, 255, 255] : [0, 0, 0];
    const left = Math.max(0, Math.floor(mask.x));
    const top = Math.max(0, Math.floor(mask.y));
    const right = Math.min(width, Math.ceil(mask.x + mask.width));
    const bottom = Math.min(height, Math.ceil(mask.y + mask.height));
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const index = (y * width + x) * 4;
        output[index] = fill[0];
        output[index + 1] = fill[1];
        output[index + 2] = fill[2];
        output[index + 3] = 255;
      }
    }
  }
  return output;
}
