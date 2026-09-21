#!/usr/bin/env python3
"""Derive the historical NYC borough asthma context from the archived NYS extract.

Filters to the five borough counties and the Total subgroup, keeping rolling multi-year periods only.
    python3 pipeline/scripts/derive-health-context.py
"""
import csv, json, pathlib

root = pathlib.Path(__file__).resolve().parents[4]
RAW = root / 'data/raw/health/asthma/org.apache.catalina.connector.RequestFacade@7e2236e5.csv'
BOROUGHS = {'Bronx': 'Bronx', 'Kings': 'Brooklyn', 'New York': 'Manhattan', 'Queens': 'Queens', 'Richmond': 'Staten Island'}
rows = []
with RAW.open(newline='', encoding='utf-8', errors='replace') as f:
    for r in csv.DictReader(f):
        county = (r['County'] or '').strip()
        if county not in BOROUGHS: continue
        if (r['subgroup1'] or '').strip() != 'Total': continue
        if (r['subgroup2'] or '').strip() != 'Total': continue
        year = (r['Year'] or '').strip()
        if '-' not in year: continue
        rows.append({
            'indicator': (r['indicator'] or '').strip(),
            'county': county,
            'borough': BOROUGHS[county],
            'period': year,
            'age_adjusted_rate_per_10000': float(r['aaRate10K']) if r['aaRate10K'] else None,
            'annual_age_adjusted_rate_per_10000': float(r['aaRate10Kpy']) if r['aaRate10Kpy'] else None,
            'events': int(r['count']) if r['count'] else None,
            'daily_mean_events': float(r['dailyMean']) if r['dailyMean'] else None,
        })
rows.sort(key=lambda r: (r['indicator'], r['borough'], r['period']))
payload = {
    'source': 'New York State Department of Health, asthma hospitalisations and ED visits (archived extract)',
    'geography_label': 'county, which for New York City is the borough',
    'period_label': 'rolling multi-year periods ending 2019 or earlier',
    'records': rows,
}
out = root / 'data/derived/health/nyc_asthma_historical.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(payload, separators=(',', ':')))
print(f'wrote {out} ({len(rows)} rows)')
