"use client";

import { useEffect, useState, type RefObject } from "react";

import type { FaceSample } from "@/features/capture/guidance/analyze";
import { assessSource } from "@/features/capture/guidance/sample";
import type { CaptureAssessment } from "@/features/capture/guidance/schema";

export function useLiveGuidance(input: {
  videoRef: RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  angleCode: string;
  baseline: Pick<FaceSample, "centerX" | "centerY" | "width"> | null;
}) {
  const [assessment, setAssessment] = useState<CaptureAssessment | null>(null);
  const baselineX = input.baseline?.centerX ?? null;
  const baselineY = input.baseline?.centerY ?? null;
  const baselineWidth = input.baseline?.width ?? null;

  useEffect(() => {
    if (!input.enabled) {
      return;
    }
    let stopped = false;
    let previous: Uint8Array | null = null;
    const baseline = baselineX === null || baselineY === null || baselineWidth === null
      ? null
      : { centerX: baselineX, centerY: baselineY, width: baselineWidth };
    const timer = window.setInterval(() => {
      const video = input.videoRef.current;
      if (!video || video.videoWidth < 2 || stopped) {
        return;
      }
      const width = 96;
      const height = Math.max(2, Math.round((video.videoHeight / video.videoWidth) * width));
      void assessSource({
        source: video,
        width,
        height,
        angleCode: input.angleCode,
        previous,
        baseline,
      })
        .then((result) => {
          if (stopped) {
            return;
          }
          previous = result.luminance;
          setAssessment(result.assessment);
        })
        .catch(() => {
          if (!stopped) {
            setAssessment(null);
          }
        });
    }, 500);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [baselineWidth, baselineX, baselineY, input.angleCode, input.enabled, input.videoRef]);

  return input.enabled ? assessment : null;
}
