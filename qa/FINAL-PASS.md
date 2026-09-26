# FIELD — visual and audio pass, 2026-09-25

## Assets

- Original Tune Tots logo and mascot sheet were NOT regenerated. Original files remain untouched.
- `src/assets/mascot/miley-record-v2.png` and `miley-world-v2.png`: connected-alpha extraction from the approved sheet, with transparent padding. The joining edge between recorder and skateboard stickers is separated in `scripts/extract-miley.py`.
- `src/assets/effects/*.webp`: nine new chrome objects generated using the built-in imagegen tool with FIELD as the material reference; optimized to 320px with alpha. No new image library is shipped.
- No FX object is claimed to be an original previously approved brand asset.

### Final generation prompt

Use case: stylized-concept. Asset type: single premium audio-effect UI object for FIELD. Input image is MATERIAL AND LIGHTING REFERENCE ONLY, do not reproduce the word. Create {subject}. Match the exact pink liquid chrome, silver reflective highlights, deep burgundy reflections, thick inflated organic polished metal of the attached FIELD typography. Hyperreal sculptural 3D render, not flat vector, not matte plastic. One centered object, fills 75% of square canvas, complete silhouette with generous transparent margins, consistent frontal three-quarter studio lighting. Genuinely transparent alpha background, no floor, no checkerboard, no rectangular backdrop, no text, no letters, no logos. Strong readable silhouette at 90px. Do not include the FIELD word.

### Subjects

- clean: one smooth inflated four-lobed liquid droplet
- warm: one soft folded molten pebble, warm rounded sculptural folds
- tape: one thick twisted oval ribbon ring with a large hole
- lofi: one curled looping molten tube with one small drip
- glitch: one irregular torus interrupted by three offset rounded metallic segments
- reverse: two joined opposing curved liquid arrows, inflated sculptural form
- pitch: one continuous inflated zigzag audio wave with three peaks
- space: one small spherical planet encircled by a tilted thick liquid ring
- destroy: one irregular six-point molten starburst with blunt inflated tips

## Verification

- Browser screenshots inspected: Home, World and FX at 375×667, 390×844, 430×932, 1280×900. Screenshots in `qa/final/`.
- Web Audio/IndexedDB diagnostics: 80 assertions passed; raw output in `qa/final/audio-checks.txt`. Test database is isolated from the user's library.
- `npm test`: phase-vocoder pitch frequency (+12, −12, +7 semitones), preserved length, degradation, stutter, stereo peak protection, fade endpoints, recording/pause/resume/stop, denied permission, late permission after discard.
- Browser FX selection and rapid switching verified. Only the latest render may play; pending pitch workers are cancelled on replacement/unmount.
- Typecheck, existing lint command, production build. Note: this repository's lint command currently runs TypeScript checking, not a separate ESLint ruleset.
- A createRoot warning occurred in the development-only QA harness during HMR, corrected with dispose/unmount. No new warning appeared in the subsequent fresh QA run.

## Audio changes

- Clean and Mix 0 are true bypass, with explicit fades applied separately.
- Reverse and Pitch use separate wet material; dry remains original. Trim is applied before processing.
- Warm: oversampled soft saturation + gentle shelves. Tape: saturation, head bump, filtering, wow/flutter. Lo-Fi: sample-and-hold/quantization and bandwidth reduction. Glitch: repeating slices with boundary crossfades. Pitch: phase-locked spectral processing + sinc resampling in a worker, preserving duration. Space: deterministic stereo room and parallel filtered echoes with 2.8s tail. Destroy: stronger saturation/degradation with controlled output.
- Stereo-linked peak attenuation prevents overloaded processed WAV output without boosting quiet recordings.
- Original duration/waveform remain independent of saved render metadata, preserving re-edit parameters.

## Boundaries

These tests establish working audio transformations, not equivalence to commercial studio plugins. No reference-plugin listening comparison was conducted. Pitch is a creative spectral effect, not formant-corrected vocal tuning. Real iPhone/Android microphone capture, mobile Safari autoplay behavior, Telegram WebView and physical keyboard/safe-area behavior still require device acceptance testing. The recording state tests use controlled mocks rather than the user's microphone. Group/World publishing and other pre-existing backend placeholders were not implemented in this pass.

## Reproduce

Run `npm run dev`, open `/qa.html` for synthetic audio checks and FX preview. This entry is development-only and is not included in the production build. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

