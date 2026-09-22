# Demonstration Script

A reviewer walkthrough, in order, with the URL state each step produces. Start from a clean checkout and run the app locally.

```bash
npm ci
npm run build
npm run preview      # serves the built release bundle
```

## 1. The product states its boundary before showing data

Open `/`. The landing story view names the release window (`NYC · 2024-01-01 → 2026-09-21`) and the status strip reads release `2026-09-22.1` and `· VALIDATED`. The summary ribbon reports ten assets and twelve source registers — release facts, not modelled metrics.


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

- Set the window with the two date inputs (defaults to the asset's own published bounds, 2025-01-01 → 2026-09-08).
- The summary reports published daily rows, facilities in the window, total counted vehicles, and the window itself.
- **By direction** and **By plaza** aggregate the published daily counts. The E-ZPass share is recomputed from summed components, not averaged across daily shares.
- Facilities retain the official source identifier, name, and full direction label.
- The provenance block repeats the asset's own limitations, including the one source group whose missing Tolls by Mail component and E-ZPass share remain null.


```text
?module=CROSSINGS&baseline=2025&comparison=2026&months=2,3,4,5,6,7,8
```

Open **CRZ** for the dedicated CRZ summary panel. It normalizes the published monthly entry asset to
detection-group totals. Detection groups are areas, so the release does not invent point coordinates.

Share either URL: both restore module, timeline date, and filters on load.

## 4. AIR — observed monitor concentrations, not a causal estimate

Open **AIR**. The module labels the data `Preliminary NYCCAS PM2.5 monitor measurements` and states
`Observed concentrations; not a causal estimate of congestion-pricing effects.` The daily map loads
from the release manifest, preserves missing and insufficient-coverage monitors, and supports daily
playback. Switch to **Hourly** to fetch the larger CSV on demand; missing hours remain missing and no
prior reading is carried forward.

## 5. CONFIDENCE — source quality and Westchester Square coverage

Open **CONFIDENCE**. Select EC/BC, NO/NO2, PM2.5, or O3 to inspect direct workbook row counts,
analytic-field completeness, QA-flag counts, and site/post coverage. These are source-quality facts,
not a statistical confidence score. Search for site `12528-EJ` to inspect its published coordinates
and coverage.

The Westchester Square section uses the official NYC NTA `BX1001` boundary. It reports zero historical
sites and zero current monitors inside. The nearest historical site is 0.188 km outside and Hunts Point
is 3.314 km outside; the map and copy keep both explicitly outside and publish no neighborhood mean.

## 6. HOTSPOTS — ranked observed traffic, not air or causality

Open **HOTSPOTS**. The month, borough, day-type, and time-band controls use the same published traffic
selection as TRAFFIC. Switch among highest published mean, largest observed 15-minute volume, and most
source observations. Every row names the ranking value and sample coverage. The view does not rank air
pollution or claim congestion pricing caused a difference.

## 7. Sources — the whole release in one place

Open **SOURCES**. The panel lists the release ID, contract version, coverage, transform version, the source registers cited, every published asset with its grain/coverage/format/CRS/checksum, each asset's limitations, and the release-level limitations.

## 8. Failure behaviour (the part that matters most)

With the built preview running, confirm the honest failure paths:

```bash
# A pointer that is not a validated release must not render data.
# Edit dist/data/manifest.json to {"status":"unpublished"} and reload: the app reports
# "NO VALIDATED RELEASE PUBLISHED" and renders no module content.
```

A tampered asset is also refused: change one byte in the built copy of `traffic_observations.geojson` under `dist/data/releases/<release-id>/` and reload the TRAFFIC module. The browser-side checksum verification fails and the module reports the mismatch instead of drawing a subset of the data.


Restore both files (or rebuild) afterwards.

## 9. Reproducing the release

```bash
cd source/github-repo
python3 scripts/release_acceptance.py        # 66 checks, 0 failed

```

The release itself is rebuilt from the registered snapshots and supplied source archives by the
unified release builder:

```bash
node pipeline/scripts/build-unified-release.mjs \
  --air-archive /path/to/nyccas-data-main.zip \
  --dot-input /path/to/Automated_Traffic_Volume_Counts_20260921.csv
```

The unified builder produces the retained eight assets. The confidence/hotspots release builder then
verifies those checksums and publishes the two new context assets as immutable release `2026-09-22.1`:

```bash
PATH="$PWD/.venv/bin:$PATH" node pipeline/scripts/build-confidence-hotspots-release.mjs
```

Both builders refuse to overwrite an existing release directory. Source checksums and derivation
counts are recorded without leaking machine-local paths.

The Kepler artifact is separate and source-side only:

```bash
python3 visualization/kepler/validate_kepler_export.py   # 34 checks, 0 failed
```
