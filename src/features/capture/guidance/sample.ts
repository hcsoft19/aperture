import { assessCapture, exposureScore, luminanceFromRgba, sharpnessScore, stabilityScore, type FaceSample } from "@/features/capture/guidance/analyze";
import type { CaptureAssessment } from "@/features/capture/guidance/schema";

type FaceDetectorBox = { x: number; y: number; width: number; height: number };
type FaceDetectorResult = { boundingBox?: FaceDetectorBox };
type FaceDetectorInstance = { detect: (source: CanvasImageSource) => Promise<FaceDetectorResult[]> };
type FaceDetectorConstructor = new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorInstance;

export async function assessSource(input: {
  source: CanvasImageSource;
  width: number;
  height: number;
  angleCode: string;
  previous: Uint8Array | null;
  baseline: Pick<FaceSample, "centerX" | "centerY" | "width"> | null;
}): Promise<{ assessment: CaptureAssessment; luminance: Uint8Array | null }> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, input.width);
  canvas.height = Math.max(1, input.height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return { assessment: unavailable(input.angleCode), luminance: null };
  }
  context.drawImage(input.source, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const luminance = luminanceFromRgba(image.data);
  const detected = await detectFace(canvas, canvas.width, canvas.height);
  const assessment = assessCapture({
    angleCode: input.angleCode,
    detector: detected.detector,
    face: detected.face,
    sharpness: sharpnessScore(luminance, canvas.width),
    exposure: exposureScore(luminance),
    stability: stabilityScore(luminance, input.previous),
    baseline: input.baseline,
  });
  return { assessment, luminance };
}

async function detectFace(source: CanvasImageSource, width: number, height: number): Promise<{ detector: "face-detector" | "none"; face: FaceSample | null }> {
  const Detector = (globalThis as { FaceDetector?: FaceDetectorConstructor }).FaceDetector;
  if (!Detector || width < 1 || height < 1) {
    return { detector: "none", face: null };
  }
  try {
    const faces = await new Detector({ fastMode: true, maxDetectedFaces: 1 }).detect(source);
    const box = faces[0]?.boundingBox;
    if (!box || box.width <= 0 || box.height <= 0) {
      return { detector: "face-detector", face: null };
    }
    return {
      detector: "face-detector",
      face: {
        centerX: clampUnit((box.x + box.width / 2) / width),
        centerY: clampUnit((box.y + box.height / 2) / height),
        width: clampUnit(box.width / width),
        height: clampUnit(box.height / height),
      },
    };
  } catch {
    return { detector: "none", face: null };
  }
}

function unavailable(angleCode: string): CaptureAssessment {
  return assessCapture({
    angleCode,
    detector: "none",
    face: null,
    sharpness: null,
    exposure: null,
    stability: null,
    baseline: null,
  });
}

function clampUnit(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
