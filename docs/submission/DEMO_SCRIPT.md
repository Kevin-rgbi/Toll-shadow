# Demonstration Script

A reviewer walkthrough, in order, with the URL state each step produces. Start from a clean checkout (`release-1-evidence-modules`) and run the app locally.

```bash
cd source/github-repo
npm ci
npm run build
npm run preview      # serves the built release bundle
```

## 1. The product states its boundary before showing data

Open `/`. The landing story view names the release window (`NYC · 2024-01-01 → 2025-12-31`) and the status strip reads `RELEASE 2026-09-16.2 · VALIDATED`. The summary ribbon reports the release ID, coverage window, published asset count, and source-register count — release facts, not modelled metrics.

Open **METHODS** for the claim guardrail and the release limitations.

## 2. Traffic observations — one module, one published asset

Open **TRAFFIC**. The module shows the selected month from the shared timeline and filters for borough, day type (Weekday/Weekend), and time band (five bands from Overnight through Evening). A count line reports how many of the month's published aggregates are on screen.

- A month carries up to a few hundred aggregates; 2025-12 carries 60, and the map draws all of them.
- The headline figures are the **count of published segment aggregates**, the source observations behind them, the mean of published segment means, the highest published segment mean, the largest observed 15-minute volume, and the observed-day range.
- Below them, the highest published segment means are listed with borough, direction, and observed days.
- The map draws the same selection as native MapLibre points, sized and coloured by published mean volume.
- At the foot of the panel, **Source and method** lists the measure ID, source register entry, coverage, grain, transform version, checksum, and the asset's limitations.

Move the timeline to **2024-07** (a month the release does not publish). The module says so explicitly and the map empties. It does not borrow August's rows.

Pick a borough, then read the URL:

```text
?module=TRAFFIC&date=2025-03-31&borough=Queens
```

## 3. Facility crossings — a different asset, a different grain

Open **CROSSINGS**. This module reads `facility_crossings`, not the traffic asset.

- Set the window with the two date inputs (defaults to the asset's own published bounds, 2024-01-01 → 2025-04-12).
- The summary reports published daily rows, plazas in the window, total counted vehicles, and the window itself.
- **By direction** and **By plaza** aggregate the published daily counts. The E-ZPass share is recomputed from summed components, not averaged across daily shares.
- Plazas appear as **published identifiers** (`Plaza 21`, `Plaza 22`, …) with a note that the release publishes no facility-name mapping.
- The provenance block repeats the asset's own limitations, including that the source is a daily aggregate and cannot support hourly analysis.

```text
?module=CROSSINGS&date=2025-01-05&crossingsFrom=2024-01-01&crossingsTo=2024-06-30
```

Share either URL: both restore module, timeline date, and filters on load.

## 4. Sources — the whole release in one place

Open **SOURCES**. The panel lists the release ID, contract version, coverage, transform version, the source registers cited, every published asset with its grain/coverage/format/CRS/checksum, each asset's limitations, and the release-level limitations.

## 5. Failure behaviour (the part that matters most)

With the built preview running, confirm the honest failure paths:

```bash
# A pointer that is not a validated release must not render data.
# Edit dist/data/manifest.json to {"status":"unpublished"} and reload: the app reports
# "NO VALIDATED RELEASE PUBLISHED" and renders no module content.
```

A tampered asset is also refused: change one byte in `dist/data/releases/2026-09-16.2/traffic_observations.geojson` and reload the TRAFFIC module. The browser-side checksum verification fails and the module reports the mismatch instead of drawing a subset of the data.

Restore both files (or rebuild) afterwards.

## 6. Reproducing the release

```bash
cd source/github-repo
python3 scripts/release_acceptance.py        # 26 checks, 0 failed
```

The release itself is rebuilt from registered raw inputs by the pipeline builder, which requires an
explicit release ID and generation timestamp:

```bash
node pipeline/scripts/build-release.mjs \
  --release-id 2026-09-16.2 \
  --generated-at 2026-09-16T02:19:51.000Z
```

This rewrites `public/data/manifest.json` and `data/releases/<id>/`. Running it with the published
release ID and timestamp reproduces the published assets **byte for byte** (see
`RELEASE_EVIDENCE.md`, "Determinism"); running it with a new ID publishes a new release and repoints
the manifest, which is the intended release path.

The Kepler artifact is separate and source-side only:

```bash
python3 visualization/kepler/validate_kepler_export.py   # 34 checks, 0 failed
```
