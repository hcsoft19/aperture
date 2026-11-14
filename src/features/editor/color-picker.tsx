"use client";

import { useId, useState } from "react";
import { REPLACEMENT_COLOR_PRESETS } from "./segmentation/types";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

export function ColorPicker({ value, onChange, disabled = false }: ColorPickerProps) {
  const id = useId();
  const [showCustom, setShowCustom] = useState(false);

  const isPreset = REPLACEMENT_COLOR_PRESETS.some((preset) => preset.value === value);

  return (
    <div className="flex flex-col gap-2">
      <fieldset className="flex flex-wrap gap-2" role="radiogroup" aria-label="Background color">
        {REPLACEMENT_COLOR_PRESETS.map((preset) => (
          <label
            key={preset.value}
            className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 ${
              value === preset.value ? "border-primary ring-2 ring-primary" : ""
            } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
          >
            <input
              type="radio"
              name={`color-preset-${id}`}
              value={preset.value}
              checked={value === preset.value}
              onChange={() => {
                setShowCustom(false);
                onChange(preset.value);
              }}
              disabled={disabled}
              className="sr-only"
            />
            <span
              className="h-5 w-5 rounded border"
              style={{ backgroundColor: preset.value }}
              aria-hidden="true"
            />
            <span className="text-sm">{preset.label}</span>
          </label>
        ))}
        <label
          className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 ${
            showCustom || !isPreset ? "border-primary ring-2 ring-primary" : ""
          } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
        >
          <input
            type="radio"
            name={`color-preset-${id}`}
            value="custom"
            checked={showCustom || !isPreset}
            onChange={() => setShowCustom(true)}
            disabled={disabled}
            className="sr-only"
          />
          <span className="text-sm">Custom</span>
        </label>
      </fieldset>

      {(showCustom || !isPreset) && (
        <div className="flex items-center gap-2">
          <label htmlFor={`custom-color-${id}`} className="sr-only">
            Custom color
          </label>
          <input
            id={`custom-color-${id}`}
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="h-11 w-20 cursor-pointer rounded border"
          />
          <input
            type="text"
            aria-label="Custom color value"
            value={value}
            onChange={(e) => {
              const val = e.target.value;
              if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                onChange(val);
              }
            }}
            placeholder="#FFFFFF"
            disabled={disabled}
            className="min-h-11 w-24 rounded-md border px-3 font-mono text-sm uppercase"
          />
        </div>
      )}
    </div>
  );
}
