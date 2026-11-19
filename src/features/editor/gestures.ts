import type { EditDocument } from "@/features/editor/schema";

export function pinchView(
  start: EditDocument["view"],
  startDistance: number,
  distance: number,
  deltaX: number,
  deltaY: number,
): EditDocument["view"] {
  const zoom = clamp(start.zoom * (distance / Math.max(startDistance, 1)), 1, 3);
  return {
    zoom,
    panX: clamp(start.panX + deltaX / 200, -2, 2),
    panY: clamp(start.panY + deltaY / 200, -2, 2),
  };
}

export function moveCrop(crop: EditDocument["crop"], deltaX: number, deltaY: number): EditDocument["crop"] {
  return {
    ...crop,
    x: clamp(crop.x + deltaX, 0, 1 - crop.width),
    y: clamp(crop.y + deltaY, 0, 1 - crop.height),
  };
}

export function resizeCrop(crop: EditDocument["crop"], deltaX: number, deltaY: number): EditDocument["crop"] {
  const width = clamp(crop.width + deltaX, 0.08, 1 - crop.x);
  const height = clamp(crop.height + deltaY, 0.08, 1 - crop.y);
  if (crop.aspect === "free" || crop.aspect === "original") {
    return { ...crop, width, height };
  }
  const ratio = crop.width / Math.max(crop.height, 0.01);
  const fittedHeight = clamp(width / ratio, 0.08, 1 - crop.y);
  return {
    ...crop,
    width: clamp(fittedHeight * ratio, 0.08, 1 - crop.x),
    height: fittedHeight,
  };
}

export function resizeMask(
  mask: { x: number; y: number; width: number; height: number },
  deltaX: number,
  deltaY: number,
) {
  return {
    width: clamp(mask.width + deltaX, 0.05, 1 - mask.x),
    height: clamp(mask.height + deltaY, 0.02, 1 - mask.y),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
