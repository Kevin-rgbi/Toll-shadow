# Toll Shadow Data Release 2026-09-20.5

Generated with transform version `pipeline-release-1.4.0`.

## Assets

- `traffic_observations`: `/data/releases/2026-09-20.5/traffic_observations.geojson` (2082788 bytes, SHA-256 `c3baeeaff9799c77e5e26448a8d3723ac90b81106b1302fb2c03d6015fc92ab7`)
  - source: https://data.cityofnewyork.us/Transportation/Automated-Traffic-Volume-Counts/7ym2-wayt/about_data
- `facility_crossings`: `/data/releases/2026-09-20.5/facility_crossings.json` (3596098 bytes, SHA-256 `b39cb694bd8f98f0ef3a2dfb844dd55fdf1a18b83794b4b0a20c2fa39f4452a8`)
  - source: https://data.ny.gov/Transportation/Daily-Traffic-on-MTA-Bridges-Tunnels/fcbp-umit/about_data
- `crz_context`: `/data/releases/2026-09-20.5/crz_entry_summary.json` (85191 bytes, SHA-256 `2b0f37d2a57975ea3068668f7a7212efdd6a2d982cead979215f685d04da1372`)
  - source: https://data.ny.gov/Transportation/MTA-Congestion-Relief-Zone-Vehicle-Entries-Beginni/t6yz-b64h/about_data
- `historical_context`: `/data/releases/2026-09-20.5/air_context.json` (34186 bytes, SHA-256 `51bd201f71dcad62a878a49c61432a6faffcac6f1a705f823c95d145813b8b97`)
  - source: https://data.cityofnewyork.us/Environment/NYCCAS-Air-Pollution-Rasters/q68s-8qxv/about_data
- `health_context`: `/data/releases/2026-09-20.5/health_context.json` (28287 bytes, SHA-256 `770554d942def23710a4de899f220ff221d5ff969a47a8013d815933bb022097`)
  - source: https://health.data.ny.gov/Health/Asthma-Hospitalization-and-Emergency-Department-Vi/7j4a-y8de/about_data
- `dac_context`: `/data/releases/2026-09-20.5/equity_context.geojson` (481251 bytes, SHA-256 `e27c3f063511107c0b0a0ada77a7e31a1d0b98f97c7b066cd00157faadeba16e`)
  - source: https://data.ny.gov/Environmental-Conservation/Disadvantaged-Communities-DAC/2e6c-s6fp/about_data

## Quality

- DOT rows: 1875154 inspected; 177571 included; 1 rejected source rows.
- MTA rows: 98053 inspected; 8352 included; 0 rejected source rows.
- CRZ aggregate rows: 252 inspected; 252 included; 0 rejected source rows.
- NYCCAS modelled surface rows: 2607 inspected; 2607 included; 0 rejected source rows.
- NYS asthma context rows: 132 inspected; 132 included; 0 rejected source rows.
- NYC disadvantaged-communities context rows: 958 inspected; 958 included; 0 rejected source rows.

## Claim boundary

This release is descriptive. It carries sampled traffic counts, daily crossing records, monthly CRZ entry aggregates, and archived context layers -- a modelled 2016 air surface published as a relative field with no established units, asthma rates in multi-year periods ending 2019 or earlier, and the 2023 disadvantaged-communities criteria, which the 2025 revision makes historical. Nothing here is a causal policy estimate, a current air-quality or health outcome, or a current designation.
