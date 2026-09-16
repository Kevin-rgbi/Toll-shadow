# Toll Shadow Agent 3 Log: Kepler, Release QA, and Hosting

**Owner:** Agent 3

## Purpose

This is the required work log for the reproducibility, Kepler validation, release QA, and Firebase Hosting lane. Read it at session start, update it before and after each meaningful phase, and continue until the assigned phase is verified or a concrete dependency is recorded. Hosting must never conceal an invalid data release.

## Mandatory Context Read Order

1. `../../AGENTS.md`
2. `../../docs/PRD.md`
3. `../../docs/DATA_STRATEGY.md`
4. `../../docs/ARCHITECTURE.md`
5. `../../docs/TECHNICAL_DESIGN_DOCUMENT.md`
6. `../../docs/ENGINEERING_PLAN.md`
7. `../../docs/TOLL_SHADOW_MHC_EVENT_AUDIT.md`
8. `../../plan/2026-09-15_21-46-00_evidence_product_delivery.md`
9. `AGENT_1_LOG.md` and `AGENT_2_LOG.md` in this directory.

The project is organized under `../../`. The preserved GitHub app is `../../source/github-repo/`. Kepler materials live in `../../visualization/kepler/`; their embedded dataset row counts are documented in the archive audit. Firebase authentication is already available, but deployed hosting must not be changed until a validated build and immutable release manifest exist.

## Shared Non-Negotiables

- Kepler is a source-side reproducibility and visual-QA artifact, not the public runtime. React plus MapLibre is the product map.
- Do not substitute the embedded Kepler datasets for validated pipeline outputs; compare them by file identity, row count, schema, date coverage, and checksum where possible.
- Do not deploy synthetic demo data, raw data, unvalidated assets, or a build that cannot fetch its release manifest.
- Production Firebase project is singular `tollshallow` (project number `1094344081770`). Repository `.firebaserc` currently names plural `tollshallows`, which is a separate, wrong target.
- The current singular site returns Firebase Site Not Found; do not claim it is repaired until a successful preview/deploy has been verified.
- Use Firebase Hosting only for static SPA/assets in Release 1; do not add Firestore, Realtime Database, or Functions without a documented requirement.

## Ownership and Boundary

**Own:** `../../visualization/kepler/` validation artifacts, `../../source/github-repo/firebase.json`, `../../source/github-repo/.firebaserc`, release/hosting scripts, deployment documentation, and environment/release QA tests.

**Do not edit:** application components under `../../source/github-repo/src/` (Agent 2), parsing/transforms/contracts/releases under Agent 1 ownership, or another agent's log. Do not deploy, delete a Firebase project, change Firebase security settings, or add backend services without a recorded release-approval handoff.

## Current Assignment

Implement plan steps A8 and A9 support work now: create repeatable Kepler export validation and release-acceptance checks; correct the repository's Firebase target in a reviewable configuration change; prepare a Hosting preview/rollback runbook. Deployment is gated on Agent 1's validated release and Agent 2's fresh production build. Record the exact Firebase target in every command and never use the plural project.

### Baseline Facts to Validate

- Kepler export `01_Traffic.json` embeds four legacy inputs: CBD zones (38 rows), prepared DOT traffic (2,559), CRZ summary (12), and prepared MTA crossings (8,352).
- Those legacy tables may have undocumented policy labels/formulas. A passing Kepler comparison means only that the export matches declared inputs, not that the inputs are analytically approved.
- The existing app's baseline `lint`, 13-test suite, and production build passed before implementation; its build emits a MapLibre chunk-size warning.

## Running Status

| UTC time | Phase | Status | Evidence / next action |
|---|---|---|---|
| 2026-09-15 | A8/A9 support | ready | Read all mandatory context. Build a Kepler validator and deployment acceptance checklist; correct `.firebaserc` through a reviewable change but do not deploy. |
| 2026-09-15 22:15 UTC | A8/A9 support | completed | Kepler validator passes 34/34 and fails on tampering; release acceptance gate accepts a valid fixture and rejects synthetic/unvalidated/unchecksummed/raw/credentialed builds; `.firebaserc` corrected to `tollshallow`; preview/rollback runbook written. No deploy performed. Blocked on A1 validated release + A2 fresh build before a preview channel. |
| 2026-09-15 23:05 UTC | Takeover: A5–A9 gap closure | completed (deploy still gated) | Agent 3 took over the remaining project work after the Agent 1 (Codex) session ended. Frontend now renders both published assets in production (TRAFFIC, new CROSSINGS module, native map layer), URL state added, hosting cache policy fixed, submission package written. 94 tests / 19 files pass, build clean, gate 24/24 green against the real release. Nothing deployed; preview deploy needs owner approval. |

### Phase Mobile optimisation — 2026-09-16 11:45 UTC

Owner request: research mobile practice, then optimise for phones.

**Research.** The search engines returned dictionary and phone-carrier noise for these queries, so the
primary sources were read directly instead of via search results: MDN's pinch-zoom gesture guide
(pointer cache, distance ratio, `touch-action` requirement) and MDN's `env()` reference for safe-area
insets. MapLibre's own touch surface was not needed because the software map is the path most phones
will take.

**Changed:**

- **Real touch gestures on the software map.** Pinch-to-zoom with two pointers, anchored so the place
  under the fingers stays under the fingers; drag unchanged; inertia after a flick with exponential
  decay, skipped under `prefers-reduced-motion`. Gesture maths extracted to
  `src/components/Map/mapGestures.ts` and covered by 11 tests, including the anchoring invariant.
- **A bug the pinch test exposed:** a pinch produces fractional zoom, and tile URLs were being built
  from it, so the map requested paths like `/11.85/x/y.png`, which a tile server cannot serve. Tiles
  are now requested at `floor(zoom)` and drawn at `2^(zoom - floor(zoom))` times their size, which is
  what every slippy map does. `tileLevelFor` / `tileScaleFactorFor` are exported and tested.
- **Bottom sheet on phones.** The data rail is now a fixed sheet over the map with a handle, a
  collapsed peek of 54px and an expanded height of 82svh, so the map stays visible while the figures
  are readable. The timeline sits directly above the collapsed sheet so scrubbing stays reachable.
  SOURCES mode opts out: it is a document, so it takes the viewport and scrolls normally.
- **Safe areas.** `viewport-fit=cover` plus `env(safe-area-inset-*)` on the masthead and the sheet, so
  notched phones do not clip content and the home indicator does not sit over the sheet's last row.
- **Touch targets and tap behaviour.** On coarse pointers the map controls and the play button become
  44px, tabs and buttons get taller padding, and filter controls get taller inputs. Buttons use
  `touch-action: manipulation` to drop the double-tap delay, and the map surface suppresses the
  long-press callout and text selection.

**Verified on a 390x844 viewport (software map):** no horizontal overflow; map 388px tall; rail fixed
and translated to its peek with the handle reading "Show the figures"; toggling expands to
`translateY(0)` with `aria-expanded` flipping correctly; timeline `bottom: 54px`; a simulated
two-finger pinch applied `scale(1.8)` around the finger midpoint, then committed to integer tile level
11 with 460.8px tiles and re-rendered the 60 points; drag still works after the rewrite; SOURCES mode
renders statically and scrolls. `npm run test` 22 files / 130 tests passed; build clean.

---

### Phase Map interaction fixes — 2026-09-16 04:40 UTC

Owner feedback: the map "keeps getting stuck" while dragging, there should be a recentre control, and
the coverage window could not be changed from the right rail. Also asked whether the product uses
Kepler.

- **Drag stutter, fixed.** The raster map was calling `setCenter` on every `pointermove`, so each
  move re-rendered every tile and up to 340 SVG points. Now the committed view stays frozen, the whole
  tile layer is moved with one `translate3d`, and the new centre is committed once on pointer-up.
  Listeners sit on the window, so a fast drag that leaves the map still tracks and still commits, and
  no pointer capture is used (capture throws for pointers the browser no longer considers active).
  Tiles are rendered with two tiles of padding so the edges do not blank mid-drag.
- **Recentre control added** (third button in the map control group, `Home` on the keyboard). It
  disables itself when the view is already home.
- **Wheel zoom** is now throttled to one committed change per animation frame.
- **Coverage window is editable from the rail.** The TRAFFIC module gained a Month select listing
  every month the release published (21 of them), which moves the shared timeline to that month rather
  than keeping a second, independent selection. CROSSINGS already had its window inputs.
- **`?map=software` / `?map=gpu`** force the renderer. Useful on a machine with a flaky GPU driver,
  and it is how the WebGL-free path is now testable on a WebGL-capable browser.

Two real defects were found while verifying, both fixed:

1. `?map=software` did nothing, because `MapShell` is lazy-loaded: by the time it mounted, the URL
   writer had already rewritten the address bar and dropped the parameter. The renderer choice is now
   part of view state, read once in `App` and passed down as a prop.
2. While moving the preference helpers into `src/lib/mapPreference.ts`, an edit sliced
   `hasWebGL2Support` out of `mapConfig.ts`. TypeScript caught it immediately; it now lives beside the
   renderer logic.

**Verified on the deployed build (software path, `?map=software`):** during a drag the layer transform
updates (`translate3d(30px,20px)` then `(80px,60px)`) while the first point's `cx` stays identical,
which is the proof that no React work happens per pointer move; on release the transform clears and
the point moves from `cx 586.47` to `666.47`. Recentre enables after a drag and disables again on
click. Month select lists 21 months. `npm run test` 21 files / 117 tests passed, gate 26 checks.

**Not done yet, and why:** the reference screenshot shows four Kepler layers. Traffic is published
(2,561 aggregates). The CBD taxi-zone boundary has an authoritative source URL recorded in the archive
and can be published reproducibly, so it is the next candidate. The MTA facility points and the 12 CRZ
detection points carry coordinates that exist only in the legacy derivative whose transformation
recipe is still undocumented, so publishing them needs a provenance decision rather than a coding
decision.

---

### Phase Build stamp and stale-build detection — 2026-09-16 04:20 UTC

Owner request: a version indicator in the top right so a cached bundle can be told apart from a
current one, and a versioned preview link.

- `vite.config.ts` defines `__BUILD_ID__` as `YYYYMMDD-HHMM-<short sha>` for production builds
  (falls back to `dev` in dev, `nogit` when git is unavailable, without failing the build).
- `src/lib/buildInfo.ts`: `BUILD_ID`, `readExpectedBuildId`, `isStaleBuild`.
- The stamp renders top right in the masthead (`Build 20260916-0016-f304920`), on mobile too.
- A link may carry `?v=<build>`. If the running build differs, a red banner names both ids and says
  to hard-reload. That is the direct answer to "is my browser cache the problem".
- The URL writer always stamps the running build into `v`, so the address bar stays a truthful record
  of what executed even when a stale bundle answered the request.

Verified: stamp renders and matches the deployed bundle; a link carrying an older id produces the
banner; a link matching the running build produces none. `npm run test` 21 files / 117 tests passed.
Gate 26 checks, 0 failed. Deployed build id `20260916-0016-f304920`, release `2026-09-16.2`.

---

### Phase Data grain: release 2026-09-16.2 — 2026-09-16 04:15 UTC

Owner feedback: the product showed far less data than the archive contains ("I also provided you a
screenshot right? There was a lot of data there"). Investigated before changing anything: the raw
archive is intact and the release covers the whole 2024-2025 window (177,571 of 1,875,154 rows; the
rest is pre-2024 and outside the policy window). Two real causes of the perceived emptiness:

1. **The published grain was coarser than the legacy Kepler table.** Release .1 published 308
   month-level aggregates; the Kepler CSV held 2,559 rows because it also split by
   Weekday/Weekend x 5 time bands. Same underlying window, ten times fewer visible points.
2. **The map rendered one month at a time** (8 points for 2025-12) with no count line, so it looked
   like missing data rather than a filtered view.

**Changed (release 2026-09-16.2, schema 1.1.0, transform pipeline-release-1.1.0):**

- `pipeline/src/traffic.mjs`: added `trafficDayType()` and `trafficTimeBand()`, exported the five
  band labels, and derived both onto every normalized observation.
- `pipeline/src/release.mjs`: group key now includes day type and time band; the asset publishes
  `day_type` and `time_band`; manifest `schema_version` 1.1.0 (additive); transform version 1.1.0.
- `pipeline/src/measure-spec.mjs`: supports spec versions 1.0.0 and 1.1.0 instead of pinning 1.0.0,
  still rejecting unknown versions.
- `pipeline/methods/release-1.yaml` and `data/contracts/traffic-observation.yaml`: document the two
  dimensions, their domains, and the omission-not-zero-fill rule.
- Frontend: `releaseData.ts` validates both dimensions against the declared domains (an unknown band
  is rejected rather than offered as a filter); `trafficSummary.ts` gained day-type/time-band filters
  and ordered option lists; `TrafficModule` gained both filters plus a "Showing N of M published
  aggregates for <month>" count line; `viewState.ts` encodes both in the shareable URL.
- `public/data/releases/2026-09-16.1/` unpublished (kept under canonical `data/releases/`), and the
  gate now asserts exactly one published release. Deployed payload fell from 8,101,496 to 4,978,982
  bytes, which was 7.73 MiB against an 8 MiB ceiling.

**Verified:** release .2 rebuilt from raw inputs is byte-identical to the published assets
(determinism holds at the new grain). 2,561 features over 195 segments and 21 months; 1,478 Weekday
and 1,083 Weekend; about 510 per band; 2025-12 carries 60. `npm run test` 21 files / 116 tests
passed. `python3 scripts/release_acceptance.py` 26 checks, 0 failed, and the new superseded-release
check was proven to reject a stale directory before being trusted. Deployed and confirmed: the
browser fetches `traffic_observations` (2,082,788 bytes, checksum matches the manifest) and the
TRAFFIC view reports "Showing 60 of 60 published aggregates for 2025-12" with 60 points drawn.

---

### Phase Redesign: light editorial front end — 2026-09-16 03:40 UTC

Owner instruction: the front end "looks like AI slop, boxes, wrong fonts"; fix the bugs first, then
rebuild the visual layer. Branch `release-1-evidence-modules`. No commits made.

**Bugs fixed (each reproduced before and after):**

1. **`RangeError: Invalid time value` blanked the app on any module deep link.** The timeline footer
   formatted `currentDateIso` while it was still `''`, one render before the release bounds seeded
   it. The footer only renders for non-STORY/SOURCES modes, which is why `?module=TRAFFIC`,
   `?module=CROSSINGS` and `?module=HOTSPOTS` produced a blank page and STORY/SOURCES did not.
   React unmounted the tree. Fix: gate the footer on `isRenderableIsoDate`; date helpers extracted to
   `src/lib/dateFormat.ts` with the invariant pinned in `tests/frontend/dateFormat.test.ts`.
2. **Firebase cached the SPA shell for an hour.** The `/index.html` header rule did not match `/`,
   so `/` and every `?module=` deep link fell to Firebase's default `max-age=3600`. Verified with
   `curl -I`: `/` returned `max-age=3600` while `/index.html` returned `no-cache`. This is what the
   owner was seeing: a cached pre-fix shell referencing a superseded bundle, which blanks on deep
   links. Fix: added a `/` no-cache rule, removed the overlapping `/data/**` rule, and the release
   gate now asserts the `/` behaviour. After deploy, `/`, `/index.html` and deep links are all
   `no-cache`; `/data/releases/**` stays `immutable`.
3. **Font stack only resolved on macOS.** `"Bodoni 72"`, `"DIN Alternate"`, `"Avenir Next"` and
   `"SF Mono"` silently fell back to generic sans elsewhere, which is most of the "vibe-coded" look.
   Replaced with self-hosted variable fonts.
4. **Horizontal overflow at mobile widths.** Grid items default to `min-width: auto`, and a `<select>`
   sizes to its longest option (216px), forcing a 390px viewport to 417px. Fixed with a
   `minmax(0, 1fr)` grid track, `min-width: 0` on grid children, and `min-width: 0; width: 100%` on
   filter controls. Verified zero overflow at 390/430/820/1024/1440/1920.

**Redesign (direction chosen by the owner: light editorial):**

- Dials: `DESIGN_VARIANCE 5`, `MOTION_INTENSITY 3`, `VISUAL_DENSITY 7`. One theme (light), one accent
  (cobalt `#1f4bd8`), one radius system (zero), no drop shadows.
- Type: self-hosted `@fontsource-variable/schibsted-grotesk` + `@fontsource-variable/jetbrains-mono`,
  imported in `main.tsx`, `woff2` bundled by Vite. Mono is used for every published numeral.
- Layout: `globals.css` rewritten from scratch as a token system. The absolutely-positioned floating
  cards are gone. New shell is a real grid: masthead, single-line mode tabs, figures strip, then a
  `minmax(0,1fr)` map column with the timeline pinned inside it, and a 400px data rail. `SOURCES`
  stands the map column down and renders as a full-width document.
- Map: light basemap treatment (desaturated, lightened toward paper) so the map reads as a figure in
  a document; boundary and published traffic points now use the cobalt ramp.
- Panels: metrics render as a hairline-ruled list with tabular numerals instead of card stacks;
  section labels moved out of the uppercase-mono style so the page does not read as an eyebrow
  rhythm on every section.
- Copy: removed every em-dash and en-dash from visible strings; the story card's `STEP N ·` chapter
  labels (banned pattern) became plain titles; `—` fallback in the ribbon became `None`.
- `index.html`: the meta description advertised a "no-toll model", which is a counterfactual this
  release explicitly does not produce. Rewritten; `theme-color` moved to paper.
- MapLibre chrome: control radius, ring shadow, attribution and zoom buttons overridden. Two real
  ordering/specificity defects were fixed to make those overrides actually apply: `maplibre-gl.css`
  is now imported before our stylesheet, and the ring override matches MapLibre's
  `:not(:empty)` specificity.

**Verified (fresh, this session):**

```text
npx tsc -b            clean, exit 0
npm run lint          no findings
npm run test          20 files, 98 tests passed
npm run build         clean; CSS 21.55 kB (was 25.47 kB)
release gate          25 checks passed, 0 failed
```

- Browser audit on the deployed channel (cache-busted): `border-radius` values non-zero: none;
  `box-shadow` values: none; horizontal overflow at 390/430/820/1024/1440/1920: none; console errors:
  0; both fonts reported `loaded`; body background `rgb(252,252,251)`.
- Nav renders on one line (8 tabs, height 39px); h1 is one line.

**WebGL2 unavailability (reported by the owner after the redesign):** the owner's Chrome reported
`MAP UNAVAILABLE / Interactive map requires WebGL2`. Two defects were found in how the app handled
that, independent of why their GPU lacks a context:

1. **The message conflated two different failures.** The same string was shown when the pre-flight
   probe failed and when the MapLibre constructor threw, so any construction failure was reported as
   a WebGL2 problem. The constructor catch now reports the real `error.name` and message, prefixed
   with `MAP_START_FAILURE_PREFIX`, and the probe message names the real cause and points at
   `chrome://gpu`.
2. **A WebGL-less browser got a dead panel.** The primary surface rendered nothing. Added
   `src/components/Map/StaticMapFallback.tsx`: the published boundary and the selected traffic points
   projected once with a plain equirectangular transform into an SVG, drawn as a figure with a caption
   that says it is a static projection of the published release and that pan and zoom need WebGL2.
   It draws only published geometry and ignores non-point features rather than inventing positions.

Verified with headless Chrome against the deployed channel:

```text
--disable-3d-apis (no WebGL2)   static-map present, 8 published traffic points drawn,
                                caption "Static view", old dead message absent, module still renders
default (WebGL2 available)      no fallback, maplibregl-canvas present
```

`npm run test` 21 files / 103 tests passed, including five cases for the fallback. Note the boundary
count is 0 because release `2026-09-16.1` publishes no `boundary_zone` asset, which is correct.

**Root cause of the WebGL2 failure (found after the owner reported it twice):** the machine is fine
and the app was not at fault. The owner's Chrome profile has hardware acceleration turned off:

```text
~/.config/google-chrome/Local State
  hardware_acceleration_mode: { enabled: False, previous: False }
```

With acceleration off, Chrome refuses a GPU context, and unlike headless Chrome it does not fall back
to software WebGL, so `getContext('webgl2')` returns null and MapLibre GL v6 cannot start. The earlier
checks in this log passed only because the headless browser available here launches with
`--enable-unsafe-swiftshader --use-angle=swiftshader-webgl`. The owner's Chrome was started with no
special flags, so the setting is the whole cause. Fix on their side:
`chrome://settings/system` -> enable "Use hardware acceleration when available" -> Relaunch.

**WebGL-free map (shipped so the product does not depend on that setting):**

- `src/components/Map/webMercator.ts`: standard tile equations, extracted so the maths is testable.
- `src/components/Map/RasterMap.tsx`: a real slippy map with no GPU requirement. Raster tiles are
  positioned with CSS, published geometry is drawn as SVG using the same projector, and pan (drag,
  arrow keys), zoom (buttons, wheel, `+`/`-`), bounding clamps, OSM attribution, keyboard focus and a
  resize observer are all implemented. It is deliberately not a degraded picture: it pans and zooms.
- `MapShell` renders `RasterMap` when the WebGL2 probe fails, and MapLibre otherwise. The raster path
  is labelled "Software map" with the reason.
- `StaticMapFallback.tsx` and its test were removed: superseded by the raster map, which draws the
  same published geometry and also works when tiles are unavailable.

Verified with headless Chrome against the deployed channel:

```text
--disable-3d-apis  8 raster tiles requested from tile.openstreetmap.org, 8 published points drawn,
                    zoom controls present, attribution present, notice "Software map",
                   module content intact, no dead "requires WebGL2" panel
default (WebGL2)   maplibregl-canvas present, raster path not used
```

`npm run test`: 21 files / 106 tests passed, including eight projection tests. One of them pins the
raster map to reality: the NYC centre must land on tile `11/603/769`, which is the tile the GPU
renderer requested in the logs. `python3 scripts/release_acceptance.py`: 25 checks, 0 failed.

**Not done / deliberately not done:** dark mode is absent (the owner chose a single light theme);
`App.tsx` (486 lines) and `MapShell.tsx` (692 lines) remain over the 400-line guideline; the
dev-prototype components and `analysis.ts` are still bundled as unreachable code; `src/App.css` and
`src/index.css` are dead files that nothing imports (left in place rather than deleted unilaterally).

**Release/deployment impact:** preview channel `preview-2026-09-16` redeployed four times during this
phase (cache fix, redesign, responsive fixes, chrome overrides). Production untouched; the public
site is still not serving.

---

### Phase Takeover A5–A9 completed — 2026-09-15 23:05 UTC

Owner instruction: take over the project's remaining work because the Agent 1 (Codex) session ended
mid-task. Branch: `release-1-evidence-modules` in `source/github-repo` (owner instruction: do not work
on `main`). No commits made.

**What was actually broken (verified, not assumed):** the application loaded and validated the
release manifest but **fetched neither published asset**. `TRAFFIC` fell through to
`ModuleUnavailable`; there was no crossings module at all, so `facility_crossings` was unreachable by
any route. The Agent 1 session's own last message reached the same conclusion ("it validates the
release manifest but does not fetch or render either approved asset"), and the
`tests/frontend/shippedManifest.test.ts` test was stale — it still asserted the pointer was
`unpublished`, so the suite failed.

**Changed (application):**

- `src/types/releaseData.ts`, `src/lib/releaseData.ts` (new) — canonical domain models and strict parsers for the two published assets. Rejects an axis-swapped coordinate, negative volume, non-integer counts, a crossing total that disagrees with its components, and an E-ZPass share that does not reproduce its numerator/denominator.
- `src/hooks/useReleaseAsset.ts` (new) — asset fetch that **verifies the manifest's SHA-256 in the browser** before parsing, and derives `loading`/`unavailable` instead of setting them in an effect.
- `src/features/traffic/TrafficModule.tsx`, `trafficSummary.ts` (new) — TRAFFIC module with month (from the shared timeline) and borough filters, descriptive summary, top published segments, and provenance.
- `src/features/crossings/CrossingsModule.tsx`, `crossingsSummary.ts` (new) — CROSSINGS module reading `facility_crossings`, with date-window, direction, and plaza aggregation. Plazas are shown as published identifiers.
- `src/components/Detail/AssetProvenance.tsx` (new) — source/method/limitation detail shared by both modules (FR-07).
- `src/components/Map/MapShell.tsx` — native MapLibre circle layer for the published traffic points, driven by the same selection as the module (FR-03).
- `src/state/appStore.ts`, `src/lib/sourceMessaging.ts` — added the `CROSSINGS` mode and its asset mapping.
- `src/App.tsx` — wiring, single shared selection for map and summary, `main.tsx` seeds the store from the URL.
- `src/lib/viewState.ts` (new) + `src/main.tsx` — shareable module/date/filter state (FR-08).
- `src/styles/globals.css` — module layout classes only; existing design tokens reused.

**Changed (data/hosting/docs):**

- `firebase.json` — cache policy: `/data/manifest.json` no-cache, `/data/releases/**` immutable, blanket `/data/**` rule removed so no two rules overlap.
- `scripts/release_acceptance.py` — added cache-policy assertions.
- `tests/frontend/shippedManifest.test.ts` — stale expectation replaced with real assertions: the shipped pointer must be a validated release, every published asset must exist on disk, match its checksum, and parse.
- `docs/submission/` (new) — `README.md`, `SOURCES_AND_METHODS.md`, `RELEASE_EVIDENCE.md`, `DEMO_SCRIPT.md`, `KNOWN_GAPS.md` (A9).
- `docs/deployment/HOSTING_PREVIEW_ROLLBACK_RUNBOOK.md` — cache-policy open item marked resolved.

**Verified (all fresh, this session):**

```text
npx tsc -b                      (clean, exit 0)
npm run lint                    (no findings)
npm run test                    19 files, 94 tests passed
npm run build                   clean; >500 kB MapShell chunk warning unchanged from baseline
python3 scripts/release_acceptance.py     24 checks passed, 0 failed — RELEASE ACCEPTED
python3 visualization/kepler/validate_kepler_export.py   34 checks passed, 0 failed
```

- Release determinism **proven**: rebuilding `2026-09-16.1` from the registered raw inputs into temporary output directories produced byte-identical assets (`traffic_observations IDENTICAL`, `facility_crossings IDENTICAL`) and identical quality counts. The check did not modify the published release or pointer.
- No synthetic data or counterfactual logic in the shipped bundle: `BOROUGH_VULNERABILITY`, `buildSyntheticHotspotRankings`, `effects.json`, and `manhattan.geojson` are all absent from `dist`. The only "synthetic demo" string in the bundle is the release validator's own rejection message.
- Real release data verified: 308 traffic features over 195 segments across 21 months (2024-07, 2024-08, 2025-08 published as gaps), 8,352 crossing rows over 464 dates, plazas 21–30.
- Two bugs found and fixed during the work rather than shipped: a TypeScript narrowing failure caused by declaring `malformed` as a const arrow instead of a function declaration, and a lint-flagged cascade from setting state synchronously inside an effect.

**Release/deployment impact:** none deployed. Gate is green for the first time, which is the
precondition for a preview channel, but no channel has been created. `tollshallow.web.app` still
returns HTTP 404.

**Open dependency or next phase:** preview deploy awaits explicit owner approval (four-point
confirmation). Production promotion is a separate approval. Remaining gaps are listed in
`docs/submission/KNOWN_GAPS.md` — most notably no CI workflow for the gate, no automated
accessibility/E2E suite, and the un-split `App.tsx`/`MapShell.tsx`.

---

### Phase A8/A9-support completed — 2026-09-15 22:15 UTC

Kepler validation, release gate, target correction, runbook.

**Changed:**

- `visualization/kepler/kepler_baseline.json` (new) — declared identity baseline for the Kepler export: 4 datasets, row counts, field lists, source paths, SHA-256, per-dataset caveats, and the claim boundary. Written from the archive audit and the preserved processed CSVs, never regenerated from the export it checks.
- `visualization/kepler/validate_kepler_export.py` (new) — repeatable validator comparing `01_Traffic.json` against the baseline and the processed CSVs by dataset id, schema, row count, ragged rows, layer wiring, source checksum, and per-cell value equality.
- `source/github-repo/scripts/release_acceptance.py` (new) — blocking pre-deploy gate.
- `source/github-repo/.firebaserc` (modified) — `tollshallows` -> `tollshallow`. Configuration only; no deploy.
- `docs/deployment/HOSTING_PREVIEW_ROLLBACK_RUNBOOK.md` (new) — preview, smoke-check, promotion, rollback, and prohibited-action runbook.

**Verified:**

- Kepler validator: `python3 visualization/kepler/validate_kepler_export.py` -> `34 checks passed, 0 failed`, exit 0.
- Kepler validator is not vacuous: against a tampered copy in `/tmp` (one value changed, one row dropped, one field dropped) it reported 5 failures and exit 1.
- Kepler export equals its declared inputs: all 4 embedded datasets match `data/processed/` CSVs exactly, 0 semantic mismatches using numeric-aware comparison (raw string diff is 962 rows, all float-formatting only, e.g. `"40.688660"` vs `40.68866`).
- Processed CSV SHA-256 values match `docs/TOLL_SHADOW_MHC_EVENT_AUDIT.md` exactly for all four prepared files.
- Release gate positive: valid fixture -> `19 checks passed, 0 failed`, `RELEASE ACCEPTED`, exit 0.
- Release gate negative, all rejected with exit 1: legacy `synthetic: true` manifest; wrong asset checksum; raw `.csv` under `dist/data`; credential string in a data asset; unpublished/empty manifest.
- Release gate against the current real build (`npm run build` then the gate): `14 passed, 4 failed` — rejected for `status='unpublished'`, `release_id: null`, empty `assets`, missing coverage. This is the intended behavior: the current candidate is not deployable and hosting must not conceal it.
- Gate credential detection was initially broken — the regex required an unquoted key and therefore missed JSON's `"token": "..."`. Fixed, then re-verified both the true positive and a clean-file false-positive check.
- Fresh Firebase CLI evidence (read-only): account has exactly one project, `tollshallow` / `1094344081770`; default site `tollshallow.web.app`; plural `tollshallows` returns HTTP 403 for this account; `tollshallow.web.app` still returns HTTP 404 Site Not Found; `tollshallows.web.app` returns HTTP 200 for an unrelated page.
- Repository checks after the config change: `npm run lint` exit 0, `npm run test` 41 passed (11 files), `npm run build` exit 0 (existing >500 kB MapShell chunk warning, unchanged).

**Commands and results:**

```text
python3 visualization/kepler/validate_kepler_export.py                      34 passed, 0 failed (exit 0)
python3 visualization/kepler/validate_kepler_export.py --export /tmp/...     29 passed, 5 failed (exit 1)
python3 scripts/release_acceptance.py --dist <valid-fixture>                 19 passed, 0 failed (exit 0)
python3 scripts/release_acceptance.py --dist <synthetic-fixture>             12 passed, 6 failed (exit 1)
python3 scripts/release_acceptance.py                                        14 passed, 4 failed (exit 1)
npx firebase projects:list                                                   tollshallow only
npx firebase hosting:sites:list --project tollshallow                        tollshallow.web.app
npx firebase hosting:sites:list --project tollshallows                       HTTP 403
npm run lint / npm run test / npm run build                                  exit 0 / 41 passed / exit 0
```

**Release/deployment impact:**

None deployed. No preview channel, no production deploy, no Firebase project/security change. `.firebaserc` now names the confirmed singular project, which will change the default target of any future `firebase deploy` run from this checkout — intentional and required, but it means the next person to run a bare `firebase deploy` without `--project` will hit `tollshallow` rather than the plural project. The runbook requires `--project tollshallow` explicitly regardless.

**Open dependency or next phase:**

1. Blocked on Agent 1 (validated A4 release with manifest, checksums, coverage, limitations) and Agent 2 (fresh production build from that release) before any preview channel. Until then the gate is red by design.
2. Cache-policy gap recorded, not fixed: `firebase.json` caches `/data/**` for 3600 s at a shared path, while `docs/ARCHITECTURE.md` calls for immutable-by-release-ID assets and a no-cache top-level manifest. The fix depends on Agent 1's release URL scheme, so it is deferred to A8 proper.
3. Gate's 8 MiB `dist/data` budget is provisional until A7 measures real payloads.
4. Preview HTTP smoke checks are manual; consider CI once a release and stable channel name exist.

**VIBEGUARD note:** the VibeGuard hooks emitted same-file-writer (W-14) and debug-print warnings during this phase. The W-14 hits attributed the gate script to "another session" while only this session was writing it — this lane is the sole writer for `scripts/` and `visualization/kepler/` — and the debug-print advisory fired on a CLI gate where `print()` is the correct user-facing output channel. Neither affected the work or its evidence.

**Claim boundary:** this phase verifies identity, schema, and value agreement between the Kepler export and its declared legacy inputs, plus the mechanical deployability of a candidate build. It does not verify that any input, policy label, hourly estimate, facility mapping, or coordinate is analytically correct, and it does not approve any measure for publication.

## Completion Handoff Template

Append a row and concise notes after each completed phase:

```text
### Phase A?-<name> completed — YYYY-MM-DD HH:MM UTC
Changed:
Verified:
Commands and results:
Release/deployment impact:
Open dependency or next phase:
```
