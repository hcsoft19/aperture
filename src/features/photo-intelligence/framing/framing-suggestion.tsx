"use client";

import type {
  FramingCrop,
  FramingSuggestion as Suggestion,
} from "@/features/photo-intelligence/framing/suggest";

export function FramingSuggestion({
  suggestion,
  onAccept,
  onReject,
}: {
  suggestion: Suggestion;
  onAccept: (crop: FramingCrop) => void;
  onReject: () => void;
}) {
  if (!suggestion.ok) {
    return <p className="text-base leading-6">A framing suggestion is not available for this photograph.</p>;
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-base leading-6">Suggested framing. The original photograph stays unchanged.</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-11 rounded-md border px-3 text-base"
          onClick={() => onAccept(suggestion.crop)}
        >
          Use suggested framing
        </button>
        <button type="button" className="min-h-11 rounded-md border px-3 text-base" onClick={onReject}>
          Keep current framing
        </button>
      </div>
    </div>
  );
}
