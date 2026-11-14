"use client";

import { useId } from "react";

type SegmentationOptInProps = {
  enabled: boolean;
  onChange: (next: boolean) => void;
};

export function SegmentationOptIn({ enabled, onChange }: SegmentationOptInProps) {
  const descriptionId = useId();

  return (
    <div>
      <label className="flex min-h-11 items-center gap-3 text-base">
        <input
          type="checkbox"
          checked={enabled}
          aria-describedby={descriptionId}
          onChange={(event) => {
            onChange(event.currentTarget.checked);
          }}
        />
        Use a presentation background estimate
      </label>
      <p id={descriptionId} className="text-base">
        This is not a clinical measurement. The original photograph stays unchanged.
      </p>
    </div>
  );
}
