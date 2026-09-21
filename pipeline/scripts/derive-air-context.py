#!/usr/bin/env python3
"""Derive the published NYCCAS air context from the archived ESRI GRID.

Run with a raster stack available (rasterio). The archive carries no unit codebook, so the surface is
published as a relative field within itself, with the pollutant and period labelled as inferred from
the source filename. Absolute concentrations are never emitted.

    python3 pipeline/scripts/derive-air-context.py
"""
import json
import pathlib

import numpy as np
import rasterio
from rasterio.warp import transform_bounds

# scripts/ -> pipeline/ -> github-repo/ -> source/ -> workspace root
root = pathlib.Path(__file__).resolve().parents[4]
GRID = root / 'data/raw/air-quality/AnnAvg_1_16_300m/aa16_bc300m'

with rasterio.open(GRID) as src:
    values = src.read(1)
    nodata = src.nodata
    transform = src.transform
    crs = src.crs
    height, width = values.shape

mask = values != nodata

# 2x2 mean pooling: a context surface does not need 300 m cells, and the payload shrinks fourfold.
# An odd dimension would silently drop its last row or column while the published bounds still spanned
# the whole raster, stretching the remaining cells over ground they do not cover, so the usable extent
# is computed first and the bounds are taken from it.
pooled_h, pooled_w = height // 2, width // 2
if pooled_h == 0 or pooled_w == 0:
    raise SystemExit(f'source raster {width}x{height} is too small to pool 2x2')
covered_w, covered_h = pooled_w * 2, pooled_h * 2
if (covered_w, covered_h) != (width, height):
    print(f'note: pooling covers {covered_w}x{covered_h} of {width}x{height}; bounds follow the covered extent')

pooled = np.full((pooled_h, pooled_w), np.nan)
for i in range(pooled_h):
    for j in range(pooled_w):
        block = values[i * 2:i * 2 + 2, j * 2:j * 2 + 2]
        block_mask = block != nodata
        if block_mask.any():
            pooled[i, j] = block[block_mask].mean()

low, high = float(np.nanmin(pooled)), float(np.nanmax(pooled))
span = high - low
if not np.isfinite(span) or span <= 0:
    # A constant surface has no range to normalise against. Dividing by it yields NaN, json.dumps
    # writes the invalid token NaN, and the release build dies in JSON.parse. Publish it flat instead,
    # which says what it is: every pooled cell carries the same value in this surface.
    print(f'note: pooled surface is flat (low={low}, high={high}); publishing a flat relative field')
    relative = [[None if np.isnan(v) else 0.5 for v in row] for row in pooled]
else:
    relative = [
        [None if np.isnan(v) else round((float(v) - low) / span, 3) for v in row]
        for row in pooled
    ]

left, top = transform * (0, 0)
right, bottom = transform * (covered_w, covered_h)
west, south, east, north = transform_bounds(crs, 'EPSG:4326', left, bottom, right, top)

payload = {
    'pollutant_label': 'black carbon, annual average (label inferred from the filename aa16_bc300m; no codebook in the archive)',
    'period_label': '2016 (inferred from the filename; not verified)',
    'source_grid': 'AnnAvg_1_16_300m/aa16_bc300m',
    'source_crs': str(crs),
    'values': 'relative 0-1 within this surface; absolute units are not established in the archive',
    'aggregation': '2x2 mean of the 300 m source cells, nodata masked, min-max normalised to this surface only',
    'bounds': [round(west, 6), round(south, 6), round(east, 6), round(north, 6)],
    'width': pooled_w,
    'height': pooled_h,
    'grid': relative,
}

out = root / 'data/derived/air-context/annual_black_carbon_relative.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(payload, separators=(',', ':')))
print(f'wrote {out} ({pooled_w}x{pooled_h} cells, {int(mask.sum())} valid source cells)')
