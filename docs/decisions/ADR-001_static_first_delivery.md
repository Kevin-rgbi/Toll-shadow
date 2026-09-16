# ADR-001: Use static, versioned data releases for Release 1

## Status

Proposed.

## Context

The project is a public evidence explorer with public, batch-oriented datasets. The current Firebase project has no database/functions implementation, and the archive is too large and heterogeneous to serve directly. The frontend already uses Vite/React/MapLibre and Firebase Hosting supports SPA delivery and preview channels.

## Decision

Use a repository-owned pipeline to generate immutable public release assets. Serve the SPA and those assets via Firebase Hosting. Do not add Firestore, Realtime Database, Functions, Cloud Run, authentication, or a realtime stream for Release 1.

## Alternatives considered

| Alternative | Decision |
|---|---|
| Firebase database + Functions | Deferred: adds operational complexity without a confirmed query/write/realtime need. |
| Direct raw data in public assets | Rejected: violates performance, provenance, and data-safety requirements. |
| Static published release assets | Chosen: reproducible, cacheable, reviewable, and aligned with current product scope. |
| Full Django/real-time architecture from comparable project | Rejected for Release 1: useful reference but disproportionate to proven requirements. |

## Consequences

- Data refreshes happen through a reviewed release build, not silently at runtime.
- The app must show the release date and source coverage.
- A future backend requires a new ADR with a specific unmet requirement and data/security design.
