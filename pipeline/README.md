# Data pipeline

The pipeline is the only route from retained raw data to browser-facing release
assets. It is intentionally batch-oriented: source data is validated,
normalized, aggregated, and versioned before the React application reads it.

## Commands

```bash
npm run pipeline:validate-catalog
npm run pipeline:test
```

The catalog command resolves `../../data/catalog/sources.yaml` from the
repository root and verifies required provenance fields, source paths, and
file checksums. Directory inputs require a future file inventory/checksum
manifest; they cannot be approved for Release 1 by this validator.

## Rules

- Raw files outside the repository are immutable inputs. Never rewrite them.
- Contract parsers reject missing columns, malformed timestamps, invalid
  counts, unsupported directions, or invalid geometry with row-aware errors.
- No parser calculates a causal effect, fills in a missing source value, or
  exposes a legacy Kepler derivative as a validated release asset.
- Published assets and the browser manifest are generated in a later release
  step, after the validated staged models and approved measure specification.
