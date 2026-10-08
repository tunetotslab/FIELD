# FIELD — PRODUCT & TECHNICAL SPECIFICATION

**Document:** `FIELD_SPEC.md`
**Product:** FIELD
**Studio:** Tune Tots Lab
**Status:** Active Development
**Document role:** Single Source of Truth

---

# 1. PRODUCT DEFINITION

## 1.1 What is FIELD?

FIELD is a mobile-first field-recording application for capturing, transforming, organizing and sharing sounds from the real world.

The central interaction is intentionally simple:

**Hear something → Record it → Transform it → Describe it → Keep it or place it in the world.**

FIELD combines:

* field recording;
* playful audio processing;
* visual sound exploration;
* emoji-based metadata;
* daily recording prompts;
* a personal sound library;
* a shared global sound map;
* music education;
* experimental sound practice.

FIELD is not intended to feel like a conventional professional audio editor.

It should feel like a **digital field notebook for sound**.

---

# 2. PRODUCT PHILOSOPHY

FIELD should make recording sound feel playful and immediate.

The user should not need to understand:

* DAWs;
* EQ;
* signal processing;
* file formats;
* audio engineering terminology.

Instead of technical interfaces, FIELD presents audio processing as playful transformations.

The product should encourage:

**Record. Explore. Listen. Collect. Share.**

The app should be understandable to:

* children;
* musicians;
* artists;
* educators;
* casual users;
* people interested in their acoustic environment.

---

# 3. CORE USER LOOP

The primary workflow is:

```text
HOME
  ↓
RECORD
  ↓
RECORDING
  ↓
PLAYBACK
  ↓
EDIT
  ↓
FX
  ↓
CHOOSE 3 EMOJI
  ↓
ADD TITLE
  ↓
SHARE
  ↓
PRIVATE / FIELD WORLD
```

This flow is the highest-priority interaction in the entire application.

It must remain:

* fast;
* obvious;
* stable;
* visually clean;
* usable on mobile.

The user should be able to create a finished sound entry in approximately 30–60 seconds.

---

# 4. MAIN NAVIGATION

Primary bottom navigation:

```text
LIBRARY

DAILY

MAP
```

Global access:

```text
SETTINGS
```

Settings must remain accessible from all major application screens.

---

# 5. HOME

## Purpose

The Home screen is the main recording entry point.

It should immediately communicate:

> FIELD is about capturing sounds around you.

## Elements

Home contains:

* `Sounds are everywhere ♡`
* Tune Tots logo
* FIELD logo
* FIELD mascot
* supporting editorial text
* main Record button
* `TAP TO RECORD`
* bottom navigation
* `Made by Tune Tots Lab`

The composition should have significant empty space.

Do not fill every area with text or decoration.

---

# 6. FIELD LOGO

The main FIELD logo is a three-dimensional organic typography object.

Text:

```text
FIELD
```

Visual reference:

> 3D typography art, the logo "FIELD" in big, puffy, rounded, fluffy letters.
>
> The letters are completely covered in a dense, short-cut green grass lawn texture, creating a soft and plush effect. Tiny, delicate white flowers, similar to baby's breath, are scattered across the surface of the letters.
>
> Style: Hyperrealistic, highly detailed, photorealistic.
>
> Lighting: Bright but soft studio lighting, emphasizing the volume of the letters and individual grass blades.
>
> Quality: cinematic, highly detailed 3D rendering.

### Asset requirements

The production asset MUST have:

* transparent background;
* clean alpha;
* no rectangular background;
* no visible bounding box;
* preserved individual grass blades around the silhouette;
* preserved flowers;
* no artificial white halo.

The asset should visually be cut around the actual shape of the typography.

Never display a gray or white rectangular image background behind FIELD.

---

# 7. MASCOT

Use the official Tune Tots / FIELD mascot asset.

Do not redraw or reinterpret the mascot unless explicitly requested.

Rules:

* preserve original proportions;
* use transparent asset;
* never stretch;
* never crop head;
* never crop feet;
* never place inside a visible rectangular image background;
* use `object-fit: contain`;
* avoid `overflow: hidden` where it clips the illustration.

The mascot should behave visually like an illustration/sticker placed in the composition.

---

# 8. HOME LAYOUT

Approximate hierarchy:

```text
Sounds are everywhere ♡

Tune Tots

FIELD

Mascot / Hero Illustration


        breathing space


        RECORD

     TAP TO RECORD


Made by Tune Tots Lab

────────────────────────
LIBRARY    DAILY    MAP
```

FIELD should be visually prominent.

The mascot should never collide with FIELD.

---

# 9. RECORDING

Pressing the central Record button opens the recording experience.

The browser requests microphone permission if required.

Use the real microphone stream.

Primary technology:

```text
getUserMedia()
MediaRecorder
Web Audio API
AnalyserNode
```

---

# 10. LIVE AUDIO VISUALIZATION

While recording, FIELD must visualize the actual incoming microphone signal.

This must NOT be a predefined animation.

Pipeline:

```text
Microphone
    ↓
MediaStream
    ↓
AudioContext
    ↓
AnalyserNode
    ↓
Visualization
```

The visualization must respond to real amplitude.

Loud sound:

```text
██████████
```

Quiet sound:

```text
▁▂▁▁▂
```

Silence:

```text
──────────
```

The visualization should feel smooth rather than excessively nervous.

---

# 11. RECORDING STATE

During recording display:

* elapsed recording time;
* live waveform / amplitude visualization;
* Stop;
* clear recording state.

Recording must continue reliably when UI components update.

UI rendering must not interfere with audio capture.

---

# 12. RECORDING PLAYBACK

After recording stops, the captured audio must immediately be playable.

Required controls:

```text
PLAY
PAUSE
RESTART
```

Pipeline:

```text
MediaRecorder chunks
      ↓
Blob
      ↓
Audio source
      ↓
Playback
```

Playback must use the actual captured recording.

Never simulate playback through UI state alone.

---

# 13. EDIT

After confirming the recording, the user enters Edit.

Edit displays the waveform of the actual recording.

The waveform must be calculated from decoded audio data.

Pipeline:

```text
Recorded Blob
      ↓
ArrayBuffer
      ↓
decodeAudioData()
      ↓
AudioBuffer
      ↓
Waveform data
      ↓
Canvas / visualization
```

The waveform must:

* represent the actual recording;
* remain visible after navigation;
* scale correctly;
* work with quiet recordings;
* never become an empty white rectangle.

---

# 14. AUDIO EFFECTS

Effects are playful transformations of the recorded sound.

They must be understandable without audio-engineering knowledge.

Every effect must actually modify audio.

Selecting an effect must never merely change the UI.

---

# 15. ORIGINAL

`ORIGINAL`

The unprocessed recording.

No DSP.

It serves as the reference for comparison with effects.

---

# 16. ECHO

Replaces the previous `CLEAN` effect.

Suggested processing:

```text
Delay
+
Feedback
+
Wet/Dry
```

Target character:

* obvious;
* musical;
* playful;
* not overwhelming.

Starting values may approximately be:

```text
delay: 250–400ms
feedback: 25–40%
```

Exact values should be tuned by ear.

---

# 17. RESONATOR

Replaces the previous `WARM` effect.

The effect should introduce strong tonal resonances into the recording.

Possible implementation:

```text
Input
 ↓
Multiple tuned resonant filters
 ↓
Wet/Dry
```

or short tuned feedback delays.

It should transform:

```text
environmental sound
```

into something more:

```text
tonal / metallic / musical
```

The result must be clearly distinguishable from Original.

---

# 18. TAPE STOP

Replaces the old generic `TAPE`.

Behaviour:

```text
normal playback
      ↓
gradual slowdown
      ↓
pitch drops together with speed
      ↓
stop
```

The effect should evoke:

* tape machine stopping;
* turntable slowdown;
* physical media losing speed.

It must not simply be a low-pass filter.

---

# 19. OTHER EFFECTS

All existing effects must undergo an audio-quality pass.

For every effect verify:

* actual DSP is active;
* audible difference;
* stable playback;
* sensible wet/dry;
* no uncontrolled feedback;
* no accidental clipping;
* no major loudness jump;
* switching effects does not break playback.

FX quality is more important than having a large number of weak effects.

## Effect chains

A recording may use a chain of up to three effects.

Requirements:

* effect order must be explicit and editable;
* each slot can be bypassed or removed;
* Original remains recoverable at all times;
* every effect in the chain must perform real DSP;
* preview and final render must use the same chain and parameters;
* the final stage must include linked-channel peak protection / limiting;
* combinations must not create uncontrolled feedback, clipping, extreme loudness
  jumps or unusable low-frequency distortion;
* changing one slot must not permanently render over the source or the other slots.

The UI should make playful combinations easy without requiring the user to
understand professional insert chains.

---

# 20. EFFECT UI

Effects should not look like generic SaaS buttons.

Visual language should connect to FIELD artwork.

Possible forms:

* inflated typography;
* glossy objects;
* tactile objects;
* bubblegum forms;
* translucent material;
* chrome;
* organic objects.

The UI should feel closer to an interactive art object than an audio plugin.

However:

**visual experimentation must never reduce usability.**

Selected FX must always be obvious.

---

# 21. CHOOSE 3 EMOJI

Every sound can be described using exactly three emoji slots.

Example:

```text
🌲  💧  🐦
```

Emoji function as playful metadata.

Each slot is independent.

Therefore this is valid:

```text
🌲 🌲 🌲
```

Do NOT enforce uniqueness.

---

# 22. EMOJI PICKER

The picker should behave similarly to a modern phone emoji keyboard.

Categories:

```text
Smileys & People
Animals & Nature
Food & Drink
Activities
Travel & Places
Objects
Symbols
Flags
```

The user can:

* scroll through the full catalogue;
* switch categories;
* search.

Use standard Unicode emoji.

---

# 23. EMOJI SEARCH

Emoji search must support keywords.

Examples:

```text
dog
→ 🐶 🐕
```

```text
music
→ 🎵 🎶 🎧 🎸 🎹
```

```text
forest
→ 🌲 🌳 🍄
```

```text
rain
→ 🌧️ ☔ 💧
```

```text
Armenia
→ 🇦🇲
```

The architecture should allow translated search keywords in the future.

---

# 24. TITLE

Users can assign a title to the recording.

Example:

```text
Rain behind the school
```

or:

```text
Metal thing near the bus stop
```

Title input requirements:

* no text clipping;
* correct line height;
* visible cursor;
* responsive width;
* sensible maximum length;
* long titles should not break layouts.

---

# 25. SHARE

After metadata is complete:

```text
SHARE TO
```

offers:

```text
PRIVATE
```

or:

```text
FIELD WORLD
```

---

# 26. PRIVATE

PRIVATE means:

> This recording belongs to the user's personal library and is not publicly visible.

Use a lock icon.

---

# 27. FIELD WORLD

FIELD WORLD is the shared global sound archive.

Publishing stores the sound together with:

```text
audio
title
emoji[3]
city
country
createdAt
```

Optional internal metadata:

```text
effect
duration
audio format
```

---

# 28. LOCATION PRIVACY

FIELD WORLD must NOT expose exact user GPS coordinates.

Public location granularity:

```text
CITY LEVEL
```

Example:

```text
Dilijan, Armenia
```

not:

```text
40.741234, 44.862384
```

The public globe marker uses approximate city coordinates.

---

# 29. MAP / FIELD WORLD

The Map screen contains a real interactive globe.

The globe must accurately represent Earth.

Continents must not be invented or distorted beyond recognition.

Visual treatment may be FIELD-like:

* pink;
* translucent;
* glossy;
* bubblegum;
* soft light;
* blur.

But the underlying geography must remain correct.

---

# 30. GLOBE INTERACTION

Users can:

* drag globe horizontally;
* drag vertically;
* swipe on touch devices;
* rotate in any direction;
* select markers.

Desktop:

```text
mouse drag
```

Mobile:

```text
touch drag
```

---

# 31. SOUND MARKERS

Published FIELD WORLD recordings appear on the globe.

Marker data:

```text
city
country
soundCount
```

Selecting a location can display:

```text
DILIJAN
7 SOUNDS
```

Opening it reveals available recordings.

A recording card may show:

```text
emoji
title
city
country
play
```

---

# 32. LOCATION CLUSTERING

If multiple recordings exist in the same city, do not place dozens of overlapping markers.

Group them.

Example:

```text
DILIJAN
27 SOUNDS
```

The user can open the location to explore recordings.

---

# 33. DAILY

DAILY encourages users to actively listen to their environment.

Each day presents a recording challenge.

Examples:

```text
SOMETHING METALLIC

SOMETHING SOFT

A SOUND FROM FAR AWAY

SOMETHING RHYTHMIC

A SOUND YOU NEVER NOTICED

SOMETHING GREEN

A SOUND THAT MOVES
```

Daily challenges should encourage listening rather than competition.

---

# 34. DAILY VISUAL ART

Each challenge can have its own photographic or graphical artwork.

For:

```text
SOMETHING METALLIC
```

use the provided photograph of metal beverage-can tabs as the current visual reference / artwork.

The image should be intentionally integrated into the composition.

Do not place it as an arbitrary raw rectangle.

Crop and frame it deliberately.

---

# 35. LIBRARY

Library is the user's personal sound archive.

The Library icon must visually communicate:

```text
collection / archive / library
```

not a generic square.

Library contains saved recordings.

Each recording should retain:

```text
audio
title
emoji
effect
date
location if available
sharing state
```

---

# 36. LIBRARY ACTIONS

Every saved recording must be playable by tapping its card or its Play control.

At minimum the user must be able to:

```text
Play
Rename
Edit title, emoji, style and location
Reopen Trim / FX editing
Change sharing state
Publish an existing private recording to FIELD World
Publish an existing private recording to a selected Tune Tots Group
Remove the user's own recording from FIELD World
Retry a failed or pending publication
Download / Save WAV in ordinary browsers, including Chrome
Open the native share sheet when the platform supports it
Delete
```

Sharing and downloading are separate actions. If the browser share sheet cannot
save the file, FIELD must still offer a direct WAV download. Opening a browser
must never leave the user with no way to save or export the recording.

A user does not need to decide visibility during the initial recording flow.
They may keep a sound private, return later, edit it and publish it afterwards.

Publishing an already saved sound must show a real state:

```text
LOCAL
PENDING UPLOAD
PUBLISHED TO WORLD
PUBLISHED TO GROUP: <name>
UPLOAD FAILED — RETRY
```

Future additions:

```text
Collections
Tags
Favorites
```

Do not implement future features unless they are currently required, but avoid architecture that prevents them.

---

# 37. SETTINGS

Settings must always be reachable from major application screens.

Use one consistent gear icon.

Settings include at minimum:

```text
Language
Privacy
Microphone
About FIELD
```

Additional settings can be added later.

---

# 38. LANGUAGES

Initial supported interface languages:

```text
English
Русский
Հայերեն
繁體中文
```

Use proper i18n architecture.

Never hardcode translations throughout JSX.

Suggested conceptual structure:

```text
locales/

en
ru
hy
zh-TW
```

Every user-facing interface string must use translation keys.

---

# 39. LOCALIZATION QUALITY

Translations must preserve meaning rather than mechanically translating individual English words.

Test layout with every language.

Russian and Armenian strings may be longer than English.

Traditional Chinese may require different line breaking.

No language may cause:

* clipping;
* overlap;
* broken buttons;
* inaccessible controls.

---

# 40. TUNE TOTS LAB

FIELD is a Tune Tots Lab project.

Main Tune Tots branding appears near the top.

Do NOT unnecessarily repeat the logo at the bottom.

Footer:

```text
Made by Tune Tots Lab
```

Centered.

Clicking it should open the official Tune Tots Lab Instagram account.

Store external URLs in configuration/constants rather than scattering them through components.

---

# 41. VISUAL IDENTITY

FIELD combines two worlds:

### Clean digital interface

* warm white;
* black typography;
* lots of negative space;
* simple navigation.

### Physical / tactile visual objects

* grass;
* chrome;
* plastic;
* bubblegum;
* photography;
* translucent materials;
* soft blur;
* hyperrealistic 3D objects.

The contrast is intentional.

---

# 42. VISUAL PRINCIPLE

FIELD should NOT look like:

* generic SaaS;
* corporate dashboard;
* Bootstrap application;
* children's educational software;
* generic pastel app;
* Barbie-style interface.

It should feel:

* contemporary;
* playful;
* editorial;
* experimental;
* tactile;
* art-directed;
* slightly strange;
* culturally current.

---

# 43. GRAPHIC ASSETS

Whenever official assets exist:

USE THEM.

Do not regenerate:

* Tune Tots logo;
* mascot;
* existing approved artwork.

For transparent assets:

* preserve alpha;
* preserve proportions;
* avoid white halos;
* avoid rectangular backgrounds.

Never redraw an approved logo merely to change its placement.

---

# 44. RESPONSIVE TARGET

FIELD is mobile-first.

Primary widths:

```text
375px
390px
430px
```

Also support desktop browser preview.

Desktop should display the mobile experience elegantly rather than stretching every component across the entire screen.

---

# 45. AUDIO ARCHITECTURE

Audio functionality should use browser-native audio technologies where practical.

Core:

```text
MediaDevices
MediaRecorder
Web Audio API
AudioContext
AudioBuffer
AnalyserNode
GainNode
BiquadFilterNode
DelayNode
ConvolverNode
```

Use AudioWorklet only when processing requires it.

Do not add heavy audio dependencies merely to implement basic functionality already supported by Web Audio API.

---

# 46. AUDIO STATE

A recording must have one canonical source.

Conceptually:

```text
Recording
├── originalBlob
├── decodedBuffer
├── duration
├── waveformData
├── selectedEffect
├── title
├── emoji
├── location
└── visibility
```

Do not create unrelated copies of the recording for every screen.

Recording → Edit → FX → Share must operate on the same logical recording.

---

# 47. NON-DESTRUCTIVE FX

Effects should preferably be non-destructive.

Keep:

```text
ORIGINAL AUDIO
```

and store:

```text
effectChain: EffectSlot[] // zero to three ordered slots
effectParameters
```

This allows the user to return to Original.

Do not permanently overwrite the source recording merely because the user previews an effect.

Saving or publishing a rendered version must not remove the canonical original
audio or the editable effect chain from the local Library. Reopening an existing
recording must restore its trim, fades, chain order, per-effect parameters and
waveform.

---

# 48. DATA MODEL

Conceptual recording model:

```typescript
interface FieldRecording {
  id: string

  title: string
  emoji: [string, string, string]

  audioAssetId: string
  durationMs: number

  effectChain: Array<{
    effect: string
    mix: number
    params?: Record<string, number>
    bypassed?: boolean
  }> // maximum 3

  visibility: 'private' | 'field-world' | 'group'
  groupId?: string
  publicationState?: 'local' | 'pending' | 'published' | 'failed'

  location?: {
    city: string
    country: string
    countryCode: string
    approximateLat: number
    approximateLng: number
  }

  dailyChallengeId?: string

  createdAt: string
  updatedAt: string
}
```

Exact implementation may differ, but preserve the conceptual separation.

---

# 49. STORAGE

Separate:

```text
AUDIO FILES
```

from:

```text
METADATA
```

Audio storage can use object storage.

Metadata belongs in the database.

Do not store large audio blobs directly inside normal metadata rows.

---

# 50. OFFLINE BEHAVIOUR

FIELD should progressively move toward offline-first behavior.

Recording must never depend on an active network connection.

At minimum:

```text
record
play
edit
effects
metadata
```

should work locally.

If publishing to FIELD WORLD is unavailable because the device is offline, preserve the recording locally and allow publishing later.

Never discard a recording because a network request failed.

---

# 51. PERMISSIONS

Microphone permissions should be requested only when needed.

If permission is denied:

show a clear friendly explanation.

Do not leave the user staring at a broken Record button.

Location permissions should never be mandatory for recording.

---

# 52. ERROR HANDLING

Handle at minimum:

```text
microphone denied
microphone unavailable
recording failure
audio decode failure
playback failure
upload failure
offline state
location unavailable
unsupported browser
```

Error states should be human-readable.

Avoid raw technical exceptions in the UI.

---

# 53. ACCESSIBILITY

FIELD is visually experimental, but core interactions must remain accessible.

Requirements:

* sufficient touch targets;
* meaningful button labels;
* keyboard accessibility where applicable;
* visible selected states;
* do not communicate important state through color alone.

---

# 54. PERFORMANCE

Avoid unnecessary React updates during audio activity.

Real-time visualization should not push high-frequency audio data through global React state.

Prefer:

```text
AnalyserNode
→ requestAnimationFrame
→ Canvas
```

instead of:

```text
AnalyserNode
→ React setState 60 times/sec
```

Audio functionality must remain independent from expensive UI rendering.

---

# 55. DEVELOPMENT PRINCIPLE

Do not rewrite working architecture simply because another implementation is theoretically cleaner.

For bugs:

```text
REPRODUCE
↓
IDENTIFY ROOT CAUSE
↓
FIX
↓
TEST
↓
VISUALLY VERIFY
```

Do not fix symptoms with arbitrary CSS offsets when the underlying layout is incorrect.

---

# 56. NO FAKE FUNCTIONALITY

The following rule is absolute.

If FIELD visually claims that something happened, it must actually have happened.

Therefore:

`REC` → actual audio capture.

`waveform` → actual recorded waveform.

`PLAY` → actual recorded audio.

`FX` → actual DSP.

`emoji search` → actual search.

`FIELD WORLD` → actual published recordings.

`globe marker` → actual sound location.

`language switch` → actual localization.

Never create fake functionality merely to make a screenshot look complete.

---

# 57. QA — CORE FLOW

Before considering a release successful, manually test:

```text
HOME
↓
RECORD
↓
STOP
↓
PLAY
↓
EDIT
↓
FX
↓
EMOJI
↓
TITLE
↓
SHARE
↓
LIBRARY / FIELD WORLD
```

Every step must work.

---

# 58. AUDIO QA

Test recordings containing:

```text
speech
clapping
quiet ambience
music
short transient sounds
continuous noise
```

For each recording verify:

* waveform;
* playback;
* duration;
* Original;
* Echo;
* Resonator;
* Tape Stop;
* every other available FX.

---

# 59. VISUAL QA

Check every major screen at:

```text
375px
390px
430px
desktop preview
```

Look specifically for:

* clipping;
* text overflow;
* rectangular image backgrounds;
* mascot cropping;
* incorrect alpha;
* overlapping elements;
* inconsistent spacing;
* misaligned icons;
* wrong selected states.

---

# 60. FIELD WORLD QA

Test:

```text
Create recording
↓
Choose FIELD WORLD
↓
Publish
↓
Open Map
↓
Locate city
↓
Open marker
↓
Find recording
↓
Play recording
```

The complete loop must work.

---

# 61. DAILY QA

Test:

```text
Open Daily
↓
View challenge
↓
Start recording
↓
Complete normal recording flow
↓
Save recording
```

The resulting recording must retain its `dailyChallengeId`.

---

# 62. DEFINITION OF DONE

A feature is NOT finished when:

```text
the code compiles
```

or:

```text
the component renders
```

or:

```text
the button changes color
```

A feature is finished when:

1. it works functionally;
2. it survives the intended user flow;
3. it is visually verified;
4. it produces no relevant console/runtime errors;
5. it behaves correctly on target mobile sizes;
6. it does not break previously working functionality.

---

# 63. CURRENT PRIORITY ORDER

Development priority:

### P0 — Core functionality

1. Reliable recording
2. Live audio visualization
3. Playback
4. Real waveform
5. Functional effects
6. Save recording

### P1 — Metadata / sharing

7. Full emoji picker
8. Emoji search
9. Title
10. Private / FIELD World
11. Library

### P1 — FIELD World

12. Real globe
13. Published recordings
14. City markers
15. Playback from globe

### P2 — Engagement

16. Daily challenges
17. Daily artwork
18. Localization

### P2 — Polish

19. FIELD grass logo
20. Mascot/layout cleanup
21. Navigation icons
22. Animation
23. Final responsive pass

Functionality must not be sacrificed for visual polish.

---

# 64. CURRENT PRODUCT VISION

FIELD should ultimately feel like a combination of:

**field recorder**

*

**sound diary**

*

**playful audio instrument**

*

**global archive of everyday sounds**

*

**sound-education tool**

*

**digital art object**

The product is successful when it makes someone notice and record a sound they would normally have ignored.

---

# 65. RULE FOR FUTURE DEVELOPMENT

Before implementing a new feature, ask:

> Does this make listening, recording, transforming or exploring sound more interesting?

If not, it probably does not belong in FIELD.

Keep the product focused.

---

# 66. STAGE 5 IMPLEMENTATION CONTRACT

World is an authenticated city-level archive, not a social network. Public rows
contain no Telegram identity, precise device coordinates, private source blobs,
group membership or authentication data. The Worker resolves and caches named
settlements; publication uses the canonical server city, never client GPS.

Audio remains in private R2. PCM WAV duration is checked from actual sample data
(maximum 60 seconds), not trusted from the submitted duration field. FX tails
are included in this maximum. World pages use a stable date + ID cursor and
city markers count the complete visible city archive, not only the first page.

Publication requires explicit consent. IndexedDB retains the audio, original,
editor settings and publication intent before upload. Repeated World requests
share an idempotency key. Pending World uploads resume while the authenticated
app is open; there is no claim of background uploading after the app closes.
Failed requests remain visible with manual Retry. Removing a World publication
does not delete the local original. Local Delete does not silently remove public
copies; users must unpublish first if they want that outcome.

Editing a Library recording creates a new local version, preserving previous
publications. New recordings keep the canonical original and all trim/FX state.
Legacy recordings without originals can only be edited from their saved render;
the app must explain this limitation. FX chains contain at most three ordered
slots with independent mix/parameters, bypass, removal and reorder, using the
same rendering path for preview/export/publication and linked-channel peak
protection. Original remains recoverable.

Reports are persisted and sent to the FIELD owner in the private bot chat.
The owner listens to WAV and chooses Keep, Hide or Delete (with confirmation).
There is no automatic irreversible speech/keyword moderation. `/reports` recovers
the pending queue if notifications fail. Hidden/removed audio is not publicly
accessible. Private course groups stay independent of World and retain old codes.
Telegram delivery retry is explicit: a timeout may be ambiguous at Telegram,
so the app warns about possible duplicate chat delivery instead of promising
exactly-once Telegram messages.

Stage 5 is not declared complete until the real two-account Telegram/mobile
publish → globe → playback → report → owner removal acceptance is recorded.
Native applications were out of scope during Stage 5. The owner authorized iOS Stage 6 on 2026-10-03; see the current contract below.

## October 2026 World feedback extension

Entering Map never automatically opens a city/sound sheet, even after publication.
Markers and city buttons explicitly open the archive. Existing Library audio can
be published without deleting/re-recording it: resolve legacy city IDs by name
and country on the server, normalize the public audio to PCM WAV and derive its
duration from samples. Never overwrite the saved local original or reapply FX.
The public copy is at most 60 seconds; disclose this before publishing.

World cards offer WAV download and a shared like count. Likes are unique per
authenticated account/sound, reversible and idempotent; no rankings, profiles or
follower features. Download tickets expire after five minutes, are signed and
scoped to a visible public World recording; private/course files never qualify.
Recheck publication visibility on every download, including previously issued
tickets. Use Telegram native download where supported and a direct browser file
link otherwise. Never claim that a file was saved merely because download was
requested.

All visible public World WAVs also go to the owner-selected @Fieldapp Telegram
destination, including existing World publications at rollout. Private Library
and course groups are excluded. Record delivery/message IDs durably, retry
explicit Telegram rejection, never blindly resend uncertain network results.
Background recovery runs every five minutes. Removal/hiding attempts to remove
the bot's Telegram message too, but downloaded/forwarded copies cannot be recalled;
publishing consent explains downloading and Telegram distribution.

Report decisions are private messages to the reporter in their chosen language.
The moderation queue/actions remain restricted to the owner in the private bot
chat. Persist outcomes and delivery state; retry failures without losing the
decision. Users must allow bot messages/start the bot; do not claim delivery to
blocked or unreachable accounts. Human Keep/Hide/Delete remain the only decisions.

## Production stabilization — October 2, 2026

City search now offers debounced country-scoped prefix suggestions from the
GitHub-versioned GeoNames catalogue (CC BY 4.0), replacing explicit-only Nominatim
search at the owner's request. Search accepts indexed alternate scripts and
transliterations. Show the interface-language label when available, English
fallback and a distinct native label. Never invent a translation. Coverage is
GeoNames cities500/admin seats, not every settlement. Stable server-resolved IDs
remain authoritative; existing World OSM IDs and user audio must survive rollout.

Library normalization is centralized at the storage boundary (schemaVersion 1).
Read-through normalization preserves raw historical rows until an explicit save;
save persists the current model while preserving original/edit/publication fields.
Visibility alone never proves successful publication. Early city/country-only
locations require city selection before World publication. World and Group share
one audio preparation path; missing bytes fail per item without deleting data.

World revalidates after foreground/reconnect, refreshes the selected city's list
and ignores cancelled responses. Private Library never supplies globe markers.
Daily retains a stable local-day task and artwork, but rechecks on foreground,
screen entry and a visible-screen timer across midnight. No storage wipe, native
application work, donation/bot rewrite or new social feature is included.

## Geographically neutral World release — October 8, 2026

World remains a core feature, but its public geography is city-only. The globe is
pink and renders one merged land mass outline with coastlines, subtle relief and
no national or disputed political borders. Markers, city sheets, sound cards,
public API responses, Telegram World captions and moderation notifications show
the city name only. Country, country code and region may remain in canonical
server records solely for search, disambiguation, safety rules and legacy repair;
they are not public World fields.

Location selection is one global city search with no country selector. A
GitHub-versioned prefix router narrows the checked-in GeoNames country shards.
Same-name suggestions may use region text and a neutral mini-map point for
disambiguation, but never display a country. No typed query or coordinate is sent
to a third-party geocoder.

For the first release, Private saving and World publication are unavailable for
Crimea, Sevastopol and the whole Donetsk, Luhansk, Zaporizhzhia and Kherson
regions. This is a fixed release-safety list, not a claim about borders or
political status and not a live front-line model. The server remains authoritative
for World publication; the client blocks Private and World destinations before
saving. Group remains available.

Appearance is an explicit Light/Dark choice. Light is the default for new users
and does not follow the device or Telegram theme. The previous stored
Device/Telegram option migrates to explicit Dark so an existing dark preference
is preserved.

## iPhone feedback follow-up — October 2, 2026

World and Group deadlines/cancellation must work in Safari without the static
AbortSignal.any/timeout methods. Legacy publication asks for missing required
emoji/title metadata before upload; audio remains untouched. Cold Home loading
reserves the logo/mascot layout so the record control never overlaps artwork.
Recording termination and audio decode have bounded recovery; a failed decode
can retry the same captured bytes instead of requiring another recording.

Daily interleaves the four prompts per artwork: each adjacent local day uses a
different approved illustration, with a stable prompt/image throughout that day.
Settings information links are ordered About FIELD, Links, Privacy, Help,
Microphone. About explains FIELD, field recordings, Tune Tots Lab, keep/share
and free access without repeated biographies or obsolete service status.

## Saved-publication and educational identity follow-up

Multipart uploads in both destinations must accept browser requests with no
Content-Length and enforce the 25 MB body limit by counting actual stream bytes.
Do not tell users a server/format/permission failure is merely an offline issue.
Distinguish audio preparation, network, city, metadata, access, session expiry,
size/rate limits and service failures; preserve local audio in every case.

About FIELD foregrounds Tune Tots Lab's electronic-music education from scratch,
original creation, classroom sketch exchange and use in tracks, alongside FIELD's
open worldwide sound community. Credit Nikola Chen (Никола Чен; Николой Ченом
in the Russian credit), the sole founder and teacher of Tune Tots Lab; author
and studio names link to their configured Instagram pages. Retain field-recording
explanation, World/private Group distinction, free access and light humour.
Every Shell provides one footer after content with breathing space. Help's contact
section offers a selectable/copyable email, optional default mail app and Gmail;
copy must not require launching a mail application.

## Immediate saved-upload and iPhone export follow-up

Metadata changes must retain the saved render; only trim/FX audio edits invalidate
it. Saved PCM WAV publication rebuilds the public header/sample duration directly,
without requiring Web Audio allocation or reapplying FX. Unsupported encodings
retain the bounded decode fallback; every preparation/network failure has a safe
stage code. Deadlines cover response bodies as well as headers.

Ready and Library prepare actual WAV bytes before export/share; neither action
requires saving or publishing successfully. In ordinary browsers, use native file
sharing or download. In Telegram WebViews, which may silently ignore blob downloads
and Web Share, use the existing signed Worker to send the explicitly requested WAV
only to the authenticated user's private FIELD bot chat. Explain this private
transfer beside the buttons. Native Telegram shareMessage opens the user's recipient
selector; if unavailable, the private bot copy remains available for saving/forwarding.
Never auto-send to other people, World or a course. Private export preserves the full
file (World/Group still cap public/shared renders at 60 seconds). Store delivery
receipts only in D1, no exported private audio in R2. Stable per-session transfer IDs
prevent duplicate delivery on retry; ambiguous Telegram delivery must require checking
the bot chat rather than automatic resending. Outside Telegram, explain the required World session rather
than implying that an empty map is the global archive. Mail offers copy, a browser
Gmail composer and an explicit default-mail option with consistent pink controls.
About contains a soft link to the existing voluntary donation screen.

## Local UnknownError and private WAV repair — October 2, 2026

A playable historical Blob must not be re-put into IndexedDB as a file-backed Blob
handle. Persist render/original ArrayBuffer bytes and their MIME types in the
versioned __fieldAudioData storage envelope. Materialize fresh Blobs at the centralized
repository read boundary. Read legacy Blob rows in place and upgrade only on explicit
save; preserve original/render samples, metadata, editor and publication state.
Read audio before starting a transaction and resolve saves only after commit. Failures
leave the old row intact and report a safe DB_OPEN/READ/WRITE or AUDIO_READ/FORMAT
stage with exception name. Never clear storage to recover. Rollback must retain the
byte-envelope reader, since explicitly saved rows now use it.

## Owner acceptance and earliest test-recording scope

After release 2318d77, the owner confirmed on a real phone that recordings saved
in private Library can be published to World and sent to a private Tune Tots Group
after closing and reopening FIELD. This confirms that workflow on the tested
phone; broader multi-device/mobile acceptance remains separate.

At the owner's explicit request, stop further repair of the owner's few earliest
personal test recordings which still fail publication. Preserve those rows and
all audio; no deletion, storage reset or automatic filtering is authorized. Do
not generalize this exception to other users or all legacy recordings. Keep the
centralized compatibility and byte-storage readers. No native app work or new
feature development was authorized by that acceptance update. The subsequent
Stage 6 authorization below supersedes the earlier native exclusion.



## Stage 6 — iOS authorized by owner (2026-10-03)

The owner explicitly authorized starting iOS now, then TestFlight/App Store;
Android/Google Play follows later. This supersedes the earlier Stage 5 native
exclusion. GitHub `tunetotslab/FIELD` remains the source of truth. Do not rebuild
the product or replace the existing Cloudflare Worker/D1/R2, Telegram bot,
World or private-group ACLs. See `FIELD_IOS_PLAN_RU.md` for actual progress.

- One React/Vite audio/editor/FX/Daily/localization implementation, bundled locally
  by Capacitor 8 in a real iOS Xcode project. No remotely loaded application shell.
- iOS private audio: protected Application Support files; metadata: SQLite.
  Commit metadata only after original/render bytes are written. Keychain stores
  standalone auth sessions. Never erase Telegram/PWA IndexedDB or localStorage.
- Telegram/PWA and native app have separate local sandboxes. Do not promise
  automatic transfer of the private Library between them. World and joined
  Groups are shared backend data after trusted account authentication.
- Standalone Telegram pairing requires an explicit matching-code approval in
  the private bot chat and confirmation of the identity in the iOS app. The
  proof never enters the Telegram link; sessions are hashed in D1, revocable,
  expire, and stay in device Keychain. Never trust a client-supplied user ID.
- Export WAV uses the iOS document picker; sharing uses the system share sheet.
  Cancelling either keeps the private original and render intact.
- App background ends recording with the captured audio and stops playback.
  No background recording capability is requested in this stage.
- Existing Stars/donation bot and web flows stay intact. The native app does not
  expose the existing Telegram donation route pending App Store payment review.
- Signed device acceptance, App Store login equivalence, account deletion,
  user blocking/filtering and privacy declarations are release gates. A green
  unsigned Xcode build is not proof of real-iPhone recording or Store approval.
- Apple Developer membership is not enrolled yet (owner confirmed). Signing,
  App Store agreements, tax/payment details and Store submission require the
  owner's account; never invent credentials or accept agreements for the owner.

## Standalone browser parity — October 3, 2026

Current owner request prioritizes the existing web/PWA while paid Apple distribution
is deferred. Native work already prepared in PR #3 stays separate; do not merge it
into this web repair or start Android work here. No old private Telegram recording
transfer is requested.

Safari/PWA must save new recordings in its own durable local `field-audio` Library,
reopen those bytes, and refresh Library on entry/foreground. Preserve the byte codec
and transaction-complete save boundary. Request persistent storage where supported
without making a rejected/unavailable persistence request fail an already committed
save. Never clear or filter existing user data. Private browser/PWA/Telegram sandboxes
are not a synchronized private cloud library; make that boundary explicit.

World and course membership use the same backend and verified Telegram numeric ID.
Standalone login uses private-bot approval, matching six-digit code and a client-only
proof; explicitly confirm the returned account before exchanging for a 30-day,
revocable bearer session. Store only hashes in D1; keep browser account state in a
separate IndexedDB database, isolate logout/expiry from recordings, and prefer signed
Mini App data inside Telegram. Revalidate World/Groups and cancel stale loads when
account changes. Bind pending World publications to the initiating account.

Do not treat a guest Safari empty map as the global archive: offer Telegram login.
Use the same visible viewport height for every shell/root, keep navigation reachable
and leave keyboard/browser chrome handling to measured viewport changes. Mail copy,
compose and Gmail controls use the same primary pink/white pill style, UI font,
font size/weight, padding and 54px minimum height as the Daily Record Now button.
Article/link prose selectors must not restyle nested mail actions. Verify this on
About, Help and Links, including the expanded default-mail choices. Donation and bot
handoffs are real Telegram links; Stars payment remains signed Mini App only.
Production builds restrict scripts with CSP and never cache authenticated requests.

Extend regressions with browser-session restore/expiry/account switch, unchanged
private bytes, browser bot approval and existing World/Group identity. Run real
WebKit layout and tab-close/reopen tests against the repository production build.
Shared Worker releases require explicit production approval; prepared GitHub
changes are not proof of deployed functionality. The owner explicitly authorized
the browser Worker/Cloudflare/web rollout on October 4, 2026. That release is
recorded in `FIELD_WORLD_GROUPS_PLAN_RU.md`; the prior outstanding approval is
resolved for this rollout. Future release approval is evaluated separately.

## Private account Library — owner request October 4, 2026

This request supersedes the October 3 exclusion of private Library sync/import.
The owner confirmed Safari/Telegram code login, World publication and public/private
Telegram Group delivery on two phones, and now explicitly requires the same personal
Library across Telegram, Safari/PWA and other signed-in devices. Native work remains
separate. Preserve existing World, Group, donations, recorder, editor and localization.

Use the existing verified numeric Telegram identity, Worker, D1 and private R2. The
private archive is separate from public sounds: no automatic World/Group publication,
public audio URLs, bot messages or access by another account. Store both original and
render bytes plus editable metadata. Centralized IndexedDB byte encoding and local
commit-before-success remain authoritative for offline saves; never reset storage.
New signed-in recordings sync after local save. Guest recordings stay local. Historical
unowned recordings require explicit confirmation of the displayed account on their
source device; Safari cannot directly read another WebView's IndexedDB. Do not claim
legacy recordings already known to belong to another account.

Use authenticated no-store list/audio routes, content hashes, revision checks,
idempotent mutations and pagination. Retry interrupted uploads without duplicating
records/bytes. Preserve conflicting edits as private copies rather than overwrite.
Account switch/logout hides account-owned cached rows without deleting audio, cancels
late requests and cannot place old-account data in the new account's visible Library.
Foreground/online/Library-entry sync must not block recording or local save. Errors
remain visible with a safe code and manual retry.

Removal propagates a tombstone across Library devices; it does not remove World/Group
publications. Cached/cloud recovery bytes remain private in this first release, with
no automatic physical purge. Explain this in Privacy; full erasure currently needs
support. Limits: 25 MB whole upload, 512 MiB reserved audio and 1,000 record identities
per account including tombstones/orphans; retries reuse reservations. Never delete
user data to make room. Additive 0008 migration only; preserve all earlier tables and
R2 objects. Push source before production migration/deploy; use existing web deployment
and shared Worker release process. Owner authorization to update the Worker/Cloudflare
and web version remains applicable to this requested web follow-up.

Regression coverage must include separate Safari/Telegram libraries, both audio parts,
metadata-only sync, offline recovery, lost response, conflicts, removal, ownership,
late account changes, quotas and unchanged public destinations. Run the production
build in real WebKit CI, retain service worker/offline tests and verify paired live
Worker/Pages versions. Physical two-phone acceptance remains a final device check.

## Cross-platform PWA audit — October 4, 2026

The owner now requests coverage of iOS Safari, installed iOS PWA, Android Chrome,
installed Android PWA, Telegram iOS and Telegram Android. This is web/PWA validation
and repair, not native Android/Capacitor work. Latest owner acceptance confirms
private Library sync between Safari and Telegram on one real iPhone; a second phone
and an older Redmi are not available during this audit. Do not report emulator,
desktop browser or SDK-fixture results as physical-device acceptance.

Run both real Chromium and WebKit engines against the production build. Cover
normal-browser, separate standalone-surface simulations and Telegram SDK fixtures,
including shared account Library, World/Group, WAV export/private Telegram relay,
offline reopen, mobile controls and safe areas. Verify actual Chromium manifest and
installability in a clean normal profile (incognito installation is restricted).
A synthetic microphone checks actual Chromium MediaRecorder Opus capture, pause,
resume, decode/editor/FX, WAV export and durable local save; physical microphone,
OS installation/launcher, keyboard, external app handoff and battery interruptions
must remain clearly marked as manual checks.

Telegram's native sheet can resize without browser visualViewport/innerHeight
updates. Bound the shell to native viewportStableHeight and visible browser height,
using viewportHeight only when stable height is unavailable. Do not follow an
unstable native animation or resize for pinch zoom; a smaller keyboard-visible
viewport wins. Preserve browser/iOS safe-area layout and all existing data.

FIELD stays installable through supported browser menus. Verify the existing
manifest identity/start URL/scope/icons; do not create a second app identity.
Document Chrome Android installation and browser-dependent alternatives plus iOS
Home Screen setup. Never promise a WebAPK on every Android browser/device. Use
GitHub CI/deployment for any repair; preserve the current Worker and data unless
backend changes are actually needed.

## Telegram bot copy and daily missions — October 8, 2026

The bot's Daily mission, Help and About pages must follow the language explicitly
selected in the bot (`en`, `ru`, `hy`, `zh-TW`); the mission body must never fall
back to English when another supported language is active. Daily uses a curated
100-mission combinatorial cycle per language, so consecutive days do not repeat.
The visible three-digit mission number is playful archive presentation and does
not claim the literal corpus size. “Another mission” must select a different item.

Help describes the current localized flow without stray English UI terms: record,
trim in the editor, chain and mix up to three effects, choose three emoji, save to
the private Library, Group or city-only World. About includes the one-world message,
the same current capabilities, light humour and the authorized Nikola Chen credit.

**END OF FIELD_SPEC.md**
