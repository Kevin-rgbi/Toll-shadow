# Unified Air And Traffic Release Implementation Plan

1. Add failing pipeline tests for NYCCAS duplicate detection, local-day/DST coverage, timestamped locations, relocation handling, and explicit null gaps.
2. Implement the reproducible NYCCAS archive derivation and inspect representative hourly and daily outputs.
3. Add failing traffic tests for source row-count validation, actual coverage, CRZ/excluded separation, and facility-crossing separation.
4. Implement official traffic snapshot aggregation and extend the DOT sampled-traffic contract through the actual supplied endpoint.
5. Extend release contracts and the release builder, publish immutable `2026-09-21.1` assets, and verify every checksum and declared source.
6. Add failing frontend tests for exact playback speeds, measured-air STORY behavior, URL state, out-of-range notices, and historical-context coexistence.
7. Implement frontend changes without altering the established visual system.
8. Update README, methods, source catalog, release evidence, known gaps, and traceability with exact rows, dates, limitations, and reproducible commands.
9. Run catalog validation, unit/pipeline tests, lint, production build, release acceptance, accessibility checks, desktop/mobile E2E, browser console checks, and representative-value audits.
10. Review the final diff for accidental deletion or unrelated changes, then commit and push normally after all required checks pass.
