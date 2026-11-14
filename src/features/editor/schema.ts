import { z } from "zod";

export const maskFills = ["#000000", "#FFFFFF"] as const;
export const canvasBackgrounds = ["original", "#FFFFFF", "#E6E6E6", "#000000"] as const;
export const frameAspects = ["free", "original", "1:1", "3:4", "4:5", "16:9"] as const;
export const segmentationModels = ["rmbg-1.4", "isnet-general-use", "modnet", "manual"] as const;

const backgroundRemovalSchema = z.object({
  enabled: z.boolean(),
  modelId: z.enum(segmentationModels),
  modelVersion: z.string().trim().min(1).max(40),
  threshold: z.number().finite().min(0).max(1),
  feather: z.number().finite().min(0).max(20),
  replacementColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export const defaultBackgroundRemoval = {
  enabled: false,
  modelId: "rmbg-1.4",
  modelVersion: "1.0.0",
  threshold: 0.5,
  feather: 2,
  replacementColor: "#FFFFFF",
} as const;

const unit = z.number().finite().min(0).max(1);
const maskSchema = z.object({
  id: z.string().uuid(),
  type: z.literal("rectangle"),
  fill: z.enum(maskFills),
  x: unit,
  y: unit,
  width: z.number().finite().gt(0).max(1),
  height: z.number().finite().gt(0).max(1),
  rotation: z.number().finite().min(-180).max(180),
  order: z.number().int().min(0).max(100),
});

export const editSchema = z
  .object({
    version: z.literal(1),
    image: z.object({
      rotation: z.number().finite().min(-1080).max(1080),
    }),
    crop: z.object({
      aspect: z.enum(frameAspects),
      x: unit,
      y: unit,
      width: z.number().finite().gt(0).max(1),
      height: z.number().finite().gt(0).max(1),
    }),
    view: z.object({
      zoom: z.number().finite().min(1).max(3),
      panX: z.number().finite().min(-2).max(2),
      panY: z.number().finite().min(-2).max(2),
    }),
    canvas: z.object({
      background: z.enum(canvasBackgrounds),
      padding: z.number().finite().min(0).max(800),
      outputAspect: z.enum(frameAspects),
    }),
    privacyMasks: z.array(maskSchema).max(20),
    backgroundRemoval: backgroundRemovalSchema.default(defaultBackgroundRemoval),
  })
  .refine((edit) => edit.crop.x + edit.crop.width <= 1.001, "Crop leaves the photograph.")
  .refine((edit) => edit.crop.y + edit.crop.height <= 1.001, "Crop leaves the photograph.")
  .refine(
    (edit) => edit.privacyMasks.every((mask) => mask.x + mask.width <= 1.001 && mask.y + mask.height <= 1.001),
    "A privacy bar leaves the photograph.",
  );

export type EditDocument = z.infer<typeof editSchema>;
export type PrivacyMask = EditDocument["privacyMasks"][number];

export function emptyEdit(): EditDocument {
  return {
    version: 1,
    image: { rotation: 0 },
    crop: { aspect: "free", x: 0, y: 0, width: 1, height: 1 },
    view: { zoom: 1, panX: 0, panY: 0 },
    canvas: { background: "original", padding: 0, outputAspect: "original" },
    privacyMasks: [],
    backgroundRemoval: { ...defaultBackgroundRemoval },
  };
}

export function parseEdit(value: unknown): EditDocument | null {
  const parsed = editSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function presentationEdited(edit: EditDocument) {
  const fullCrop = edit.crop.x === 0 && edit.crop.y === 0 && edit.crop.width === 1 && edit.crop.height === 1;
  return (
    !fullCrop ||
    edit.image.rotation !== 0 ||
    edit.canvas.padding !== 0 ||
    edit.canvas.background !== "original" ||
    edit.privacyMasks.length > 0 ||
    edit.backgroundRemoval.enabled
  );
}
