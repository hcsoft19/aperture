# MVP 2 implementation plan

Audit date: 14 November 2026. The editor described below has since been implemented. This file remains the original audit. Current behavior is in `docs/specification.md`. MVP 5 adds suggestions on top of this editor and does not replace it.

## What already exists

The app is Next.js 16.4.6, React 19.3.0, TypeScript strict, Tailwind CSS 4, shadcn/ui on Base UI, Zod 4, and Supabase. Node 22 or newer is required. Tests are Vitest plus SQL files in `tests/database`. There is no Playwright suite and no canvas or Konva dependency. `sharp` is already used on the server to make private WebP previews, not to edit originals.

Clinical photographs live in `public.photos`, one angle per `photo_sessions` row. The original file is uploaded from the browser to the private `clinical-photos` bucket. Database triggers reject changes to an uploaded original's file fields and reject deletion of an uploaded photograph. A follow-up overlay is a signed URL and is not saved as a new image.

Comparisons live in `public.comparisons`. One row stores `before_photo_id`, `after_photo_id`, and `alignment` jsonb: `x`, `y`, `rotation`, `scale`, and `aligned`. Postgres requires the same treatment and the same protocol angle. The capture screen (`src/features/capture/comparison-preview.tsx`) shows a side-by-side pair and a keyboard slider, and it applies the alignment as a CSS transform on the follow-up only. Saving updates the latest non-revoked row for that pair. The patient portal (`src/features/portal/released-comparison.tsx`) repeats the same two views and does not let the patient edit. The clinic gallery (`src/features/gallery`) lists sessions and saved comparisons and opens `/results/[resultId]`.

There is no photo-detail route and no editor. A session thumbnail links to `/capture/[sessionId]` or, from some staff views, to `/api/clinic-photos/[photoId]`, which returns a resized WebP of at most 1000 pixels. That preview must not become the export source.

Authorization is `getClaims()` plus `organization_members` and `patient_accounts`. Patients read a photograph only when its session is released or its comparison is shared and not revoked. The public clinic showcase publishes selected results separately. An editor must not change those published pixels unless a professional explicitly publishes again.

`react-konva` 19.3.2 declares a peer dependency on React 19.3, so it can be installed later. It is not the recommended engine for the first editor. Privacy bars, crop, pan, zoom, and rotation are affine metadata. The current comparison already draws with CSS. A DOM canvas plus pointer events stays inside the existing stack, avoids a client-only scene graph, and keeps every history entry as a small JSON object. Browser canvas is used only when flattening an export. Revisit Konva only if touch handles for simultaneous pinch and rotation prove unreliable.

## Decisions that need approval

1. Edit on a DOM surface. Do not add Konva in Phase 2.
2. Store revisions in a new `photo_edit_revisions` table. Do not alter `photos` file columns.
3. Store flattened derivatives in a new private bucket, `photo-derivatives`. Do not reuse the original path pattern in `clinical-photos`.
4. Extend `comparisons.alignment` for layout and revision ids. Do not add `comparison_layouts`.
5. Record exports in the existing `audit_events` table. Do not add `photo_export_events`.
6. Patients never read revision JSON. They can see a flattened derivative only when the session is released or the comparison is shared.
7. The public showcase keeps its current images until a professional publishes again.

These choices avoid breaking migrations. They still change the product surface, so implementation should wait for approval.

## Coordinate system

Schema version 1. All mask geometry is relative to the untouched source image, origin at the top left, values from 0 to 1.

The render order is fixed:

1. Start from the original pixel buffer.
2. Rotate the image by `image.rotation` degrees, clockwise, around its center. Quarter turns and the fine angle share this one number.
3. Crop in that rotated space. `crop.x`, `crop.y`, `crop.width`, and `crop.height` are fractions of the rotated image.
4. Place the cropped result on a canvas of `canvas.background` with `canvas.padding` in source-image pixels, then scale to the selected output aspect ratio.
5. Draw privacy masks in source space through the same transform, then flatten them into the export pixels.

Zoom and pan in the editor are part of `view` and are saved. They must not be confused with the comparison alignment scale, which stays in its current range of 0.5 to 2.

```json
{
  "version": 1,
  "image": { "rotation": 0 },
  "crop": { "aspect": "free", "x": 0, "y": 0, "width": 1, "height": 1 },
  "view": { "zoom": 1, "panX": 0, "panY": 0 },
  "canvas": { "background": "original", "padding": 0, "outputAspect": "original" },
  "privacyMasks": []
}
```

`canvas.background` is `original`, `#FFFFFF`, `#E6E6E6`, or `#000000`. Mask `fill` is `#000000` or `#FFFFFF` only. `aspect` and `outputAspect` are `free`, `1:1`, `3:4`, `4:5`, `16:9`, or `original`. A Zod schema in `src/features/editor/schema.ts` is the application boundary. Invalid documents are rejected before insert.

## Database

Add one new migration with `supabase migration new`. Do not edit the historical files.

`photo_edit_revisions`

- `id`, `photo_id`, `revision_number`, `schema_version`, `edit_data` jsonb, `created_by`, `created_at`
- Unique `(photo_id, revision_number)`
- No update and no delete policies
- Insert and select only for staff of the photograph's organization
- No patient select policy

`photo_derivatives`

- `id`, `photo_id`, `edit_revision_id`, `storage_path`, `mime_type`, `width`, `height`, `file_size_bytes`, `created_by`, `created_at`
- Private bucket `photo-derivatives`
- Staff of the organization can insert and read
- A patient can read a derivative only when `private.patient_can_view_photo(photo_id)` is true
- The original bucket policies stay unchanged

`comparisons.alignment` gains optional fields read by a new parser and ignored by today's parser: `version`, `layout` (`side_by_side`, `slider`, `stack`), `syncFraming`, `beforeRevisionId`, `afterRevisionId`, and independent `before` / `after` view objects. The existing `x`, `y`, `rotation`, `scale`, and `aligned` fields remain. The save action must write the whole object, including the fields it does not edit, so a later save does not wipe them.

`audit_events.action` values: `photo.edit_saved` and `photo.exported`. Metadata stores ids, format, and whether a mask or framing edit was applied. It does not store image bytes.

## Where the editor opens

New route: `/patients/[patientId]/photos/[photoId]/edit`.

The query `from` is checked with the existing safe-path helper and is used by Back and by the post-save return. Entry links:

- Session photographs on the treatment page.
- The capture session, beside the current comparison.
- A clinic result at `/results/[resultId]`, one link for the baseline and one for the follow-up when those photographs belong to the clinic.

There is no separate photo-detail page today. The editor is that detail surface. Demo gallery plates and external credited images are not editable.

The editor is a client component under `src/features/editor`. It loads the original through a short-lived signed URL created on the server for a staff member of that clinic. The 1000-pixel WebP route remains the thumbnail source only.

Layout follows the existing shell. On a narrow screen the tools sit in a bottom bar: masks, crop, rotate, canvas, and the original/edited control. On a wide screen the same controls sit in a side panel. Top bar: Back, angle and date, Undo, Redo, Save. Touch targets stay at least 44px. Pointer events on the canvas call `preventDefault` so the page does not scroll. A dirty editor asks for confirmation before Back.

## Editor behavior by later phase

Phase 2, after approval, adds the route, original loading, crop presets, zoom from 1 to 3, pan, quarter turns, fine rotation from -20 to 20 degrees, and the original/edited toggle. Nothing is saved yet. The original file is never uploaded again.

Phase 3 adds black and white rectangles. A bar can be added, selected, dragged, resized, rotated, and deleted. Several bars are allowed. A drag gesture is one history entry, recorded on pointer up. History keeps at most 50 entries and stores JSON, not image copies. Canvas choices are the original bounds, white, light gray, and black, plus padding. This is padding around the photograph, not removal of the background behind the person.

Phase 4 adds the migration, RLS, save, and reopen. Save appends the next revision number. It does not update older revisions. Reopening loads the highest revision. The first automated checks cover the Zod schema, history, and a staff-versus-other-clinic SQL case beside the existing `tests/database` files.

Phase 5 extends the capture comparison and the patient view. Add a vertical stack next to the current side-by-side and slider. Add a synchronize-framing switch for zoom, crop aspect, and viewport, with separate fine sliders so the photographs can still be adjusted independently. Matching angles stay mandatory through the current action and `private.guard_comparison`. A comparison stores the revision ids it used. A newer revision does not change an older comparison.

Phase 6 exports JPEG and PNG in the browser from the original bytes. Masks are drawn into the pixels. The export does not contain a second unmasked layer. EXIF is omitted by encoding a new image from pixel data. A presentation-edited export shows the words "Presentation edit" in the image margin. Downloads are authorized through the same staff or released-derivative rule. Saved derivatives go to `photo-derivatives`. Comparison export supports side-by-side and vertical stack, with optional labels and treatment dates. No generative retouching and no clinic-branded template in this phase.

Phase 7 fills the remaining tests: mask geometry through the render order, flattened export dimensions, mismatched angles rejected, patient denied revision JSON, and cross-clinic derivative reads denied. Browser checks on a phone-sized viewport cover the toolbar, unsaved warning, and slider. Playwright is added only for the editor save path and one comparison path, using synthetic fixtures.

## What stays unchanged

Capture, consent, session status, original immutability, invitation flow, patient release, and the showcase publication flow stay as they are. Existing comparison rows remain valid. The landing-page demo portrait is not a clinical photograph and is not an editor target.

## Risks

- A signed original loaded into a phone canvas can exhaust memory. The on-screen preview may be scaled down. The export step reads the original and scales the final canvas to the requested output size, with a clear failure when the browser cannot allocate it.
- Identical crop numbers do not mean the faces match. The comparison copy must keep saying that framing is manual.
- Privacy bars hide pixels in an export. They do not make a face anonymous.
- The live site at `https://aperture-sigma-gilt.vercel.app` is a hosted prototype. This plan does not deploy to it.

## Approval requested

The seven decisions above were approved and implemented. The editor, revisions, derivatives, comparison layouts, and browser export are in the repository. Automated coverage is `tests/unit/editor.test.ts` and `tests/database/photo-edits.sql`. A hosted database needs `supabase db push` before the new save and export actions are used there.
