"use client";

import { useState } from "react";
import Image from "next/image";
import { Columns2, ImageIcon, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";

const views = ["Side by side", "Baseline", "Follow-up"] as const;
type View = (typeof views)[number];

export function PhotographyPreview() {
  const [view, setView] = useState<View>("Side by side");

  return (
    <figure className="photo-preview">
      <div className="preview-toolbar">
        <div className="preview-label"><span className="preview-dot" /> A patient journey</div>
        <span className="preview-demo">Interactive demo</span>
      </div>
      <div className="preview-controls" role="group" aria-label="Photography preview view">
        {views.map((item) => (
          <button key={item} type="button" aria-pressed={view === item} onClick={() => setView(item)} className={cn("preview-control", view === item && "is-selected")}>
            {item === "Side by side" ? <Columns2 aria-hidden="true" size={16} /> : <ImageIcon aria-hidden="true" size={16} />}
            {item}
          </button>
        ))}
      </div>
      <div className={cn("preview-portraits", view !== "Side by side" && "is-single")} aria-live="polite">
        {(view === "Side by side" ? ["Baseline", "Follow-up"] : [view]).map((label) => (
          <div key={label} className="preview-portrait">
            <div className={cn("preview-photo", label === "Follow-up" && "is-followup")}>
              <Image src="/demo-portraits.png" alt={`Fictional ${label.toLowerCase()} portrait for the photography demonstration`} fill sizes="(min-width: 900px) 760px, 180vw" priority className="object-cover" />
            </div>
            <span className="portrait-caption">{label}<span>Front view</span></span>
          </div>
        ))}
      </div>
      <div className="preview-footer"><span><ScanLine aria-hidden="true" size={18} /> Consistent views. A clearer perspective.</span><span>Originals preserved</span></div>
      <figcaption className="preview-disclaimer">Illustrative demo with AI-generated portraits. Not a patient or treatment result.</figcaption>
    </figure>
  );
}
