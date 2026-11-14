# MVP 5 — advanced photography intelligence

Linear milestone: Advanced Photography Intelligence, FRA-45 through FRA-56. This release is a scoped on-device subset. It does not identify a person, score a treatment, or replace an original photograph.

## Boundaries

Safe uses are framing metadata, uniform alignment of the follow-up, setup tips from existing warning codes, a session completeness check from protocol angle ids, and an opt-in background estimate for presentation only.

Excluded: facial recognition, embeddings, stored landmarks, diagnosis, outcome scores, generated after-photographs, and automatic changes to originals. MediaPipe and other hosts that download a vision model during capture stay out.

## Behavior

- Framing and alignment are suggestions. The professional uses or keeps the current framing, and accepts or rejects alignment. Different protocol angles are not aligned. Scale is uniform. Rotation is clamped. Pixels are not warped.
- Setup tips are ranked from the MVP 3 warning codes. `OPENROUTER_API_KEY` may ask OpenRouter to phrase those codes. The free models are tried first (`openrouter/free`, `meta-llama/llama-3.2-3b-instruct:free`, `qwen/qwen-2.5-7b-instruct:free`). `OPENROUTER_FALLBACK_MODEL` is next. The fixed sentences remain when the models are down or the key is absent. The request contains warning codes only.
- Unavailable guidance, including a missing face detector with no other warning, produces no ranked advice.
- Session review lists missing and duplicate angles. It does not move photographs.
- Background estimation runs only when `NEXT_PUBLIC_SEGMENTATION=on` and the professional opts in. A flat or tiny frame is refused. The result is a coverage number, not a new clinical image.
- Longer browser work can be cancelled and retried. Failures use a plain sentence.

## Data

`photo_suggestions` records an accepted or rejected suggestion for the clinic. Patients cannot read it. The payload is small JSON and must not contain pixels or embeddings. Historical comparisons stay in `comparisons.alignment`.

## Not claimed

Physical-device timing, fairness across cameras, and a full segmentation model are not measured here. FRA-54 and FRA-56 stay open as evaluation work. The heuristic versions are `framing-heuristic-1`, `alignment-heuristic-1`, and `segmentation-heuristic-1`.
