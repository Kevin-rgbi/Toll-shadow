#!/usr/bin/env python3
"""Derive the published equity context from the archived 2023 NYC disadvantaged-communities layer.

Geometry is simplified for display only, topology preserved. The layer is the archived 2023 criteria;
the 2025 Version 2.0 revision makes a current-designation claim unsupportable, so the vintage is
published with the data.

    python3 pipeline/scripts/derive-equity-context.py
"""
import json, pathlib
from shapely.geometry import shape, mapping

root = pathlib.Path(__file__).resolve().parents[4]
src = json.load(open(root / 'data/raw/boundaries/disadvantaged-communities/NYC_Disadvantaged_Communities.geojson'))
# The key set is the union across every feature, never one feature's shape. Taking it from the first
# feature alone meant that a key it happened to lack was dropped from all of them, publishing nulls and
# making the module state that no percentile is published for tracts that have one.
EXPECTED = ('GEOID', 'County', 'Pop_Cnt', 'Vulner_Pct', 'Traff_Veh', 'Asthma', 'PM25')
present = set()
for f in src['features']:
    present |= set(f['properties'])
missing = [k for k in EXPECTED if k not in present]
if missing:
    raise SystemExit(f'archived layer is missing expected properties {missing}; refusing to publish a partial key set')
keys = list(EXPECTED)
out = []
for f in src['features']:
    geom = shape(f['geometry'])
    if not geom.is_valid:
        geom = geom.buffer(0)
    simple = geom.simplify(0.0004, preserve_topology=True)
    out.append({'type': 'Feature', 'geometry': mapping(simple),
                'properties': {k: f['properties'].get(k) for k in keys}})
payload = {
    'vintage': '2023 disadvantaged-communities criteria (archived layer); the 2025 Version 2.0 update makes a current-designation claim unsupportable',
    'geography_label': 'census tract polygons clipped to New York City',
    'properties': keys,
    'aggregation': 'geometry simplified with a 0.0004 degree tolerance, topology preserved, for display only',
    'features': out,
}
p = root / 'data/derived/equity/nyc_dac_2023_simplified.geojson'
p.parent.mkdir(parents=True, exist_ok=True)
p.write_text(json.dumps(payload, separators=(',', ':')))
print(f'wrote {p} ({len(out)} features)')
