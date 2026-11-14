import { layoutEdit } from "@/features/editor/layout";
import type { EditDocument } from "@/features/editor/schema";

export async function renderEditBlob(
  source: CanvasImageSource & { width: number; height: number },
  edit: EditDocument,
  mimeType: "image/jpeg" | "image/png",
) {
  const layout = layoutEdit(source.width, source.height, edit);
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("The export could not be prepared.");
  }

  context.fillStyle = layout.background;
  context.fillRect(0, 0, layout.width, layout.height);
  context.save();
  context.translate(layout.image.x, layout.image.y);
  context.rotate((layout.image.rotation * Math.PI) / 180);
  context.drawImage(source, -source.width / 2, -source.height / 2);
  context.restore();

  for (const mask of layout.masks) {
    context.save();
    context.translate(mask.x, mask.y);
    context.rotate((mask.rotation * Math.PI) / 180);
    context.fillStyle = mask.fill;
    context.fillRect(0, 0, mask.width, mask.height);
    context.restore();
  }

  if (layout.presentationEdited) {
    context.font = "16px sans-serif";
    context.fillStyle = edit.canvas.background === "#000000" ? "#FFFFFF" : "#292327";
    context.fillText("Presentation edit", 12, Math.max(20, layout.height - 16));
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mimeType, 0.92);
  });
  if (!blob) {
    throw new Error("The export could not be prepared.");
  }

  return { blob, width: layout.width, height: layout.height };
}
