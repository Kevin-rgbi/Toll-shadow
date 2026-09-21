# Demonstration Script

A reviewer walkthrough, in order, with the URL state each step produces. Start from a clean checkout and run the app locally.

```bash
npm ci
npm run build
npm run preview      # serves the built release bundle
```

## 1. The product states its boundary before showing data

Open `/`. The landing story view names the release window (`NYC · 2024-01-01 → 2025-12-31`) and the status strip reads the current release ID and `· VALIDATED`. The summary ribbon reports the release ID, coverage window, published asset count, and source-register count — release facts, not modelled metrics.


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

## 3. Facility crossings and CRZ context — different assets, different grains

Open **CROSSINGS**. The monthly comparison panel reads `facility_crossings` and `crz_entries`, not
the traffic asset.

- Set the window with the two date inputs (defaults to the asset's own published bounds, 2024-01-01 → 2025-04-12).
- The summary reports published daily rows, plazas in the window, total counted vehicles, and the window itself.
- **By direction** and **By plaza** aggregate the published daily counts. The E-ZPass share is recomputed from summed components, not averaged across daily shares.
- Plazas appear as **named facilities** resolved from the source register's `facility_ids` mapping, alongside their published identifier. An unmapped plaza fails the build rather than rendering nameless.
- The provenance block repeats the asset's own limitations, including that the source is a daily aggregate and cannot support hourly analysis.


```text
?module=CROSSINGS&baseline=2025&comparison=2026&months=2,3,4,5,6,7,8
```

Open **CRZ** for the newer dedicated CRZ summary panel. It normalizes the published monthly entry
asset to detection-group totals and labels the points as approximate supplied context markers.

Share either URL: both restore module, timeline date, and filters on load.

## 4. AIR — observed monitor concentrations, not a causal estimate

Open **AIR**. The module labels the data `Preliminary NYCCAS PM2.5 monitor measurements` and states
`Observed concentrations; not a causal estimate of congestion-pricing effects.` The daily map loads
from the release manifest, preserves missing and insufficient-coverage monitors, and supports daily
playback. Switch to **Hourly** to fetch the larger CSV on demand; missing hours remain missing and no
prior reading is carried forward.

## 5. Sources — the whole release in one place

Open **SOURCES**. The panel lists the release ID, contract version, coverage, transform version, the source registers cited, every published asset with its grain/coverage/format/CRS/checksum, each asset's limitations, and the release-level limitations.

## 6. Failure behaviour (the part that matters most)

With the built preview running, confirm the honest failure paths:

```bash
# A pointer that is not a validated release must not render data.
# Edit dist/data/manifest.json to {"status":"unpublished"} and reload: the app reports
# "NO VALIDATED RELEASE PUBLISHED" and renders no module content.
```

A tampered asset is also refused: change one byte in the built copy of `traffic_observations.geojson` under `dist/data/releases/<release-id>/` and reload the TRAFFIC module. The browser-side checksum verification fails and the module reports the mismatch instead of drawing a subset of the data.


Restore both files (or rebuild) afterwards.

## 7. Reproducing the release

```bash
cd source/github-repo
python3 scripts/release_acceptance.py        # 49 checks, 0 failed

```

The release itself is rebuilt from registered inputs by the monthly release builder:

```bash
node pipeline/scripts/build-release.mjs \
  --release-id 2026-09-20.4 \
  --generated-at 2026-09-21T00:46:32.000Z

```

This rewrites `public/data/manifest.json` and `data/releases/<id>/`. The builder refuses a release ID
that disagrees with `pipeline/methods/release-1.yaml` and refuses to overwrite an existing release
directory, so a rebuild either matches the declared release or fails. Reproducibility was checked by
building a scratch ID from the same inputs and timestamp and comparing the payloads: **6 of 6 assets
byte-identical** (see `RELEASE_EVIDENCE.md`, "Determinism").

The Kepler artifact is separate and source-side only:

```bash
python3 visualization/kepler/validate_kepler_export.py   # 34 checks, 0 failed
```
