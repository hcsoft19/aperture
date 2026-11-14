# MVP 8 — Universal Clinical Photo Background Removal

Linear milestone: Universal Clinical Photo Background Removal, FRA-84 through FRA-96. This release adds non-destructive background removal and replacement to the existing photo editor, supporting any clinical photograph subject.

## Audit Summary

### Existing Editor Architecture (MVP 2)

The editor at `/patients/[patientId]/photos/[photoId]/edit` provides non-destructive presentation edits:

- **Route**: `src/app/patients/[patientId]/photos/[photoId]/edit/page.tsx`
- **Core component**: `src/features/editor/photo-editor.tsx`
- **Schema**: `src/features/editor/schema.ts` defines `EditDocument` (version 1)
- **Export**: `src/features/editor/export-image.ts` renders edits to canvas
- **History**: `src/features/editor/history.ts` manages undo/redo (50 entries max)
- **Server actions**: `src/features/editor/actions.ts` handles save/export

Current `EditDocument` schema (version 1):
```typescript
{
  version: 1,
  image: { rotation: number },
  crop: { aspect, x, y, width, height },
  view: { zoom, panX, panY },
  canvas: { background, padding, outputAspect },
  privacyMasks: PrivacyMask[]
}
```

Canvas backgrounds: `original`, `#FFFFFF`, `#E6E6E6`, `#000000` (solid colors behind the entire image).

### Existing Segmentation (MVP 5)

The current segmentation is a heuristic estimate only:

- **Location**: `src/features/photo-intelligence/segmentation/estimate.ts`
- **Method**: Border-color comparison heuristic (`segmentation-heuristic-1`)
- **Output**: Coverage percentage, not a mask
- **UI**: `segmentation-opt-in.tsx` checkbox, presentation estimate only
- **Storage**: `photo_suggestions` records acceptance/rejection

This heuristic does not produce a usable alpha mask for background replacement.

### OpenRouter Integration (MVP 5)

Current OpenRouter usage in `src/lib/openrouter/complete.ts`:

- **Purpose**: Text completion for setup tips/recommendations
- **Free models**: `openrouter/free`, `meta-llama/llama-3.2-3b-instruct:free`, `qwen/qwen-2.5-7b-instruct:free`
- **Guard**: `assertTextOnly()` explicitly blocks image data
- **Credentials**: Server-side only (`OPENROUTER_API_KEY`)

### Storage Schema

- **Originals**: `clinical-photos` private bucket, immutable after upload
- **Derivatives**: `photo-derivatives` private bucket, organization-scoped paths
- **Revisions**: `photo_edit_revisions` table with `edit_data` JSONB
- **RLS**: Organization-scoped via `private.photo_organization_id()`

## OpenRouter Image Processing Evaluation

### Current OpenRouter Capabilities

OpenRouter is a **unified API gateway for language models**. As of this audit:

1. **No native image segmentation**: OpenRouter routes to text/chat completion models. It does not host or route to image-to-image, inpainting, or segmentation models.

2. **Vision models are text-output only**: Models like GPT-4V, Claude 3, Gemini can analyze images but produce text descriptions, not alpha masks or edited images.

3. **No background removal models**: Standard background removal (rembg, U2-Net, IS-Net) requires specialized image processing endpoints that OpenRouter does not provide.

4. **API structure**: The `/chat/completions` endpoint accepts images as input for vision models but returns text, not modified images.

### Recommendation

OpenRouter cannot serve as the primary segmentation resolver for MVP 8. The implementation must use **on-device processing** as the primary method:

| Route | Use Case | Status |
|-------|----------|--------|
| OpenRouter | Text-based image analysis (future) | Not suitable for masks |
| Local ONNX | On-device segmentation | **Primary** |
| Manual brush | User correction | **Fallback** |

If OpenRouter adds image-to-image models in the future, the adapter can be extended. The architecture must support both routes.

## Local Segmentation Options

### Option A: Transformers.js + ONNX (Recommended)

**Library**: `@xenova/transformers` or `@huggingface/transformers`

**Models**:
- `briaai/RMBG-1.4` — 176MB, high quality, broad subject support
- `schirrmacher/isnet-general-use` — IS-Net architecture, ~44MB
- `Xenova/modnet` — MODNet, ~26MB, optimized for people

**Advantages**:
- Runs entirely in browser (no server round-trip)
- No image data leaves the device
- Supports WebGPU acceleration where available
- MIT/Apache licensed models available

**Considerations**:
- Initial model download (26–176MB depending on choice)
- Memory usage during inference (~300–800MB)
- First-run latency (model load)

### Option B: MediaPipe Selfie Segmentation

**Library**: `@mediapipe/selfie_segmentation`

**Advantages**:
- Small model (~2MB)
- Fast inference
- Well-tested on faces/people

**Limitations**:
- Optimized for full-person selfies
- May struggle with partial body, hands, close-ups
- Not suitable for non-human clinical subjects

### Recommendation

Use **Transformers.js with a general-purpose model** as primary, with **manual brush fallback** when segmentation fails or is unavailable. The chosen model should support:

- Full body and partial body
- Face (front, profile, 45°)
- Mouth/lips/teeth close-ups
- Hands and feet
- Skin area close-ups
- Non-human clinical subjects

IS-Net or RMBG-1.4 are the best candidates for clinical photography.

## Schema Design (Version 2)

Extend `EditDocument` to version 2 with backward compatibility:

```typescript
{
  version: 2, // Increment for new schema
  image: { rotation: number },
  crop: { aspect, x, y, width, height },
  view: { zoom, panX, panY },
  canvas: { background, padding, outputAspect },
  privacyMasks: PrivacyMask[],
  
  // New in version 2
  backgroundRemoval?: {
    enabled: boolean,
    modelId: string,           // e.g., "isnet-general-use-v1"
    modelVersion: string,      // e.g., "1.0.0"
    threshold: number,         // 0.0–1.0, default 0.5
    feather: number,           // 0–20 pixels
    replacementColor: string,  // hex color or "transparent"
    
    // Manual corrections (brush strokes)
    corrections?: {
      version: 1,
      strokes: BrushStroke[]
    }
  }
}

type BrushStroke = {
  id: string,
  mode: "add" | "remove",     // Add to or remove from foreground
  points: [number, number][], // Normalized 0–1 coordinates
  radius: number,             // Brush radius in normalized units
  timestamp: number
}
```

### Mask Storage

Generated masks are **not stored in the database**. They are:
1. Computed on-demand from the original image
2. Cached in browser memory/IndexedDB during editing
3. Flattened into the derivative on export

Manual corrections (brush strokes) **are stored** in `edit_data` as they represent user intent.

This avoids storing large binary masks and ensures masks can be regenerated with newer models.

## Database Changes

### Migration: `20261115XXXXXX_background_removal_schema.sql`

```sql
-- Extend photo_edit_revisions schema_version constraint
alter table public.photo_edit_revisions
  drop constraint photo_edit_revisions_schema_version,
  add constraint photo_edit_revisions_schema_version
    check (schema_version in (1, 2));

-- Optional: Model usage tracking for analytics
create table public.segmentation_usage (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos (id) on delete cascade,
  model_id text not null,
  model_version text not null,
  processing_ms integer,
  success boolean not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id)
);

create index segmentation_usage_photo_id_idx
  on public.segmentation_usage (photo_id);

alter table public.segmentation_usage enable row level security;
alter table public.segmentation_usage force row level security;

create policy segmentation_usage_insert_staff
  on public.segmentation_usage
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and (select private.is_org_staff(private.photo_organization_id(photo_id)))
  );

-- Staff can read usage for their org's photos
create policy segmentation_usage_select_staff
  on public.segmentation_usage
  for select
  to authenticated
  using ((select private.is_org_staff(private.photo_organization_id(photo_id))));

-- Patients cannot read segmentation usage
revoke all on table public.segmentation_usage from public, anon, authenticated;
grant select, insert on public.segmentation_usage to authenticated;
```

## Implementation Phases

### Phase 1: Segmentation Adapter & Model Loading (FRA-86)

Create a provider-agnostic segmentation interface:

```typescript
// src/features/editor/segmentation/types.ts
export interface SegmentationResult {
  ok: true;
  mask: ImageData;  // Alpha channel as grayscale
  modelId: string;
  modelVersion: string;
  processingMs: number;
} | {
  ok: false;
  reason: "unsupported_device" | "model_load_failed" | "processing_failed" | "cancelled";
}

export interface SegmentationAdapter {
  id: string;
  name: string;
  isAvailable(): Promise<boolean>;
  loadModel(): Promise<void>;
  segment(image: ImageBitmap, signal?: AbortSignal): Promise<SegmentationResult>;
  unloadModel(): void;
}
```

Implement adapters:
1. `LocalONNXAdapter` — Transformers.js with IS-Net/RMBG
2. `ManualAdapter` — User draws mask from scratch

### Phase 2: Background Renderer (FRA-87)

Extend `export-image.ts` to composite foreground over replacement color:

```typescript
function applyBackgroundRemoval(
  context: CanvasRenderingContext2D,
  mask: ImageData,
  replacementColor: string,
  threshold: number,
  feather: number
): void
```

Color presets: `#FFFFFF` (white), `#F5F5F5` (off-white), `#E6E6E6` (light gray), `#000000` (black), and a custom color picker.

### Phase 3: Editor UI (FRA-88)

Add "Background" tool to the existing tool tabs:

```
[Masks] [Crop] [Rotate] [Canvas] [Background]
```

Background tool panel:
- Remove Background button (triggers segmentation)
- Color presets and custom picker
- Threshold slider (0–1)
- Feather slider (0–20px)
- Before/after toggle
- Reset button

Mobile considerations:
- Processing indicator with cancel
- Touch-friendly color picker
- Minimum 44px touch targets

### Phase 4: Mask Refinement (FRA-89)

Add brush correction tools:
- Add foreground brush (paint back subject pixels)
- Remove foreground brush (paint out background pixels)
- Brush size slider
- Undo per-stroke

Store corrections in `edit_data.backgroundRemoval.corrections`.

### Phase 5: Integration & Order of Operations (FRA-90)

Ensure correct render order:
1. Original image
2. Rotation
3. Crop
4. **Background removal (apply mask)**
5. Canvas background/padding
6. Privacy masks
7. Flatten to export

Background removal applies to the rotated/cropped image, not the original coordinates.

### Phase 6: Storage & RLS (FRA-91)

- Derivatives include flattened background in export
- No separate mask storage (regenerate from corrections + model)
- Usage tracking in `segmentation_usage`
- RLS prevents patient access to correction metadata

### Phase 7: Testing & Validation (FRA-94, FRA-95)

Test fixtures covering:
- Full body (standing, sitting)
- Partial body (torso, limbs)
- Face (front, profile, 45°)
- Mouth/teeth close-up
- Hands
- Feet
- Skin texture close-up
- Complex backgrounds (clinical equipment, furniture)

Performance targets:
- Model load: <5s on mid-range device
- Segmentation: <3s for 2000×3000 image
- Export: <2s

### Phase 8: Feature Flag & Rollout (FRA-96)

Feature flag: `NEXT_PUBLIC_BACKGROUND_REMOVAL=on`

Default: **off** until validated

Rollout:
1. Internal testing with synthetic fixtures
2. Clinic beta with opt-in
3. General availability

## Privacy & Security

### Image Processing

- **On-device only**: No images sent to external services
- **No persistent masks**: Regenerated on demand
- **Corrections are metadata**: Brush strokes are coordinates, not pixels
- **Export-only output**: Background removal visible only in derivatives

### Patient Access

- Patients **cannot** read `backgroundRemoval` metadata in `edit_data`
- Patients **can** view derivatives when session is released
- No indication of whether background was removed in patient view

### Audit

New audit event: `photo.background_removed`
```json
{
  "modelId": "isnet-general-use-v1",
  "replacementColor": "#FFFFFF",
  "hasCorrections": true
}
```

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Model download size (26–176MB) | Lazy load, cache in IndexedDB, show progress |
| Memory exhaustion | Limit to one model at a time, show device requirements |
| Poor segmentation on edge cases | Manual brush fallback, clear messaging |
| Mobile performance | WebGPU where available, fallback warning |
| Model licensing | Use MIT/Apache models only |

## Decisions Requiring Approval

1. **Use Transformers.js + IS-Net/RMBG** as primary segmentation engine
2. **Store corrections as brush strokes** in `edit_data`, not binary masks
3. **Regenerate masks on demand** rather than storing them
4. **Add `segmentation_usage` table** for model analytics
5. **Feature flag default off** until validation complete
6. **No OpenRouter integration** for segmentation (text-only gateway)

## Files to Create/Modify

### New Files
- `src/features/editor/segmentation/types.ts`
- `src/features/editor/segmentation/local-adapter.ts`
- `src/features/editor/segmentation/manual-adapter.ts`
- `src/features/editor/segmentation/model-loader.ts`
- `src/features/editor/background-tool.tsx`
- `src/features/editor/brush-correction.tsx`
- `src/features/editor/color-picker.tsx`
- `tests/unit/segmentation.test.ts`
- `tests/unit/background-removal.test.ts`
- `supabase/migrations/20261115XXXXXX_background_removal_schema.sql`

### Modified Files
- `src/features/editor/schema.ts` — Version 2 schema
- `src/features/editor/photo-editor.tsx` — Add Background tool
- `src/features/editor/export-image.ts` — Apply mask in render
- `src/features/editor/actions.ts` — Handle version 2, usage tracking
- `src/types/database.ts` — Regenerate types

## Not Included in MVP 8

- OpenRouter/cloud segmentation (no suitable models available)
- Image generation or inpainting
- Automatic background replacement with scenes
- Gradient or image backgrounds
- Multi-subject selection
- AI-suggested backgrounds
- Batch processing
- Real-time preview during capture
