# Toll Shadow Data Release 2026-09-21.1

This immutable release integrates official 2025-2026 measured air and traffic data. It is descriptive and non-causal.

## Rebuild

```sh
node pipeline/scripts/fetch-official-traffic-snapshots.mjs
node pipeline/scripts/build-unified-release.mjs --air-archive /path/to/nyccas-data-main.zip --dot-input /path/to/Automated_Traffic_Volume_Counts_20260921.csv
```

NYCCAS archive SHA-256: `c51fd1127ac71d23125c0e19a368de1747f7564d321ba8066e59becdfed76e04`. DOT snapshot SHA-256: `14d10d768c0398ebec41642c8b8deec2540c6165afb6f8f1a6231349b3619744`.

See `quality.json` and the manifest for exact coverage, grain, source URLs, row counts, checksums, and limitations.
