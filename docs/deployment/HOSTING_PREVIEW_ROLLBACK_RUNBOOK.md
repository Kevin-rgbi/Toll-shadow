# Firebase Hosting Preview and Rollback Runbook

**Owner:** Agent 3
**Status:** prepared, not executed. No preview channel and no production deploy has been run from this workspace.

This runbook is the only approved path from a candidate build to `tollshallow.web.app`. Its purpose is that hosting never conceals an invalid data release: every step before a channel deploy is a gate, and a failed gate stops the run.

## Verified target facts (re-checked 2026-09-15)

| Fact | Value | How it was verified |
|---|---|---|
| Firebase account project count | 1 project | `firebase projects:list` (CLI, authenticated) |
| Project display name / ID | `TollShallow` / `tollshallow` | `firebase projects:list` |
| Project number | `1094344081770` | `firebase projects:list` |
| Default Hosting site | `tollshallow` — `https://tollshallow.web.app` | `firebase hosting:sites:list --project tollshallow` |
| Plural `tollshallows` | not accessible to this account — HTTP 403 | `firebase hosting:sites:list --project tollshallows` |
| Current singular site state | HTTP 404, Firebase "Site Not Found" | `curl https://tollshallow.web.app/` |
| Current plural site state | HTTP 200, unrelated page (636 bytes) | `curl https://tollshallows.web.app/` |

The repository `.firebaserc` previously named the plural project. It now names `tollshallow`; see "Configuration change" below.

**Do not treat the singular site as repaired.** It returns Site Not Found until a successful preview/deploy is verified in step 5.

## Preconditions (all must hold)

1. Agent 1 has published a validated release with a manifest, asset checksums, coverage, and limitations.
2. Agent 2 has produced a fresh production build from that release; `npm run lint`, `npm run test`, and `npm run build` pass for the current commit.
3. `visualization/kepler/validate_kepler_export.py` passes (Kepler stays a research artifact; it must not be mistaken for the runtime).
4. The release acceptance gate passes — see step 2. **A red gate is a hard stop.**
5. Deployment authority is recorded: only Agent 3 runs hosting commands, and production promotion requires an explicit owner release-approval handoff.

## Steps

### 1. Build the candidate

```bash
cd <workspace>/source/github-repo
npm ci
npm run lint
npm run test
npm run build
```

Record the commit SHA and the exact release ID being built. Stop on any failure.

### 2. Run the release acceptance gate (blocking)

```bash
python3 scripts/release_acceptance.py
```

This rejects a candidate that is missing a build, marked `synthetic: true`, unvalidated, missing required release metadata, missing an asset checksum, shipping raw/archive payloads, over the browser-asset budget, or carrying credentials — and it rejects a `.firebaserc` that does not name `tollshallow`.

Add `--json` for a machine-readable record to attach to the release evidence.

### 3. Deploy a preview channel (never straight to live)

```bash
firebase hosting:channel:deploy <release-id> --project tollshallow --expires 7d
```

Always pass `--project tollshallow` explicitly. Do not rely on the default from `.firebaserc`, and never pass the plural project. The command prints the preview URL; record it.

### 4. Post-deploy smoke checks

```bash
PREVIEW=<preview-url-from-step-3>
curl -fsS "$PREVIEW/"                      | head -c 200     # SPA shell loads
curl -fsS "$PREVIEW/data/manifest.json"    | head -c 400     # manifest loads, release_id + status=validated
curl -fsSI "$PREVIEW/data/manifest.json"   | grep -i cache-control
curl -fsSI "$PREVIEW/assets/<hashed>.js"   | grep -i cache-control
```

Expected cache behavior from `firebase.json`: `data/manifest.json` → `no-cache, max-age=0, must-revalidate`; hashed JS/CSS → `max-age=31536000, immutable`; other `/data/**` → `max-age=3600`.

Confirm the manifest served in the preview is the release built in step 1 — compare `release_id` and the asset `sha256` values against the gate output. A preview that serves a different release is a stop condition.

### 5. Promote to production (owner approval required)

Promotion is a separate, explicitly approved action. Before running it, confirm: preview verified in step 4, owner signoff recorded, and no open gate failures.

```bash
firebase deploy --only hosting --project tollshallow
```

Then re-run the smoke checks against `https://tollshallow.web.app/` and record the result. The Site Not Found condition is only considered resolved after this step returns a serving SPA.

## Rollback

Rollback is a Hosting-level operation; it does not roll back data. Because published releases are immutable, a bad data release is corrected by publishing a new release ID and a new manifest pointer — never by patching a published asset in place.

```bash
# list prior releases, newest first
firebase hosting:releases:list --project tollshallow

# roll the live site back to a previous release version
firebase hosting:rollback --project tollshallow

# remove a bad preview channel
firebase hosting:channels:delete <channel-id> --project tollshallow
```

After any rollback: re-run the step 4 smoke checks, record which release the live site is serving, and note the incident in the Agent 3 log.

## Prohibited actions

- Deploying without a green step 2 gate, or deploying while any precondition is unmet.
- Deploying to `tollshallows` (plural) or omitting `--project`.
- Deleting or recreating a Firebase project, or changing Firebase security settings, without a recorded release-approval handoff.
- Adding Firestore, Realtime Database, Functions, or Cloud Run for Release 1 (ADR-001).
- Patching a published release in place, or shipping raw archives, unvalidated assets, or synthetic data.
- Claiming the public site is fixed without a successful step 4 verification in the same session.

## Configuration change already made

`.firebaserc` was corrected from `tollshallows` to `tollshallow` as a reviewable configuration change only. No deploy, no site change, and no Firebase security change accompanies it. Rationale and fresh CLI evidence are in the table above.

## Open items

1. ~~**Cache policy vs. immutable releases.**~~ **Resolved.** `firebase.json` now serves `/data/manifest.json` with `no-cache, max-age=0, must-revalidate` and `/data/releases/**` with `public, max-age=31536000, immutable`. The previous blanket `/data/**` 3600 s rule was removed rather than reordered, so no two rules overlap and there is no glob-precedence ambiguity. The release acceptance gate now asserts both headers.
2. **Asset budget is provisional.** The gate's 8 MiB `dist/data` ceiling is a placeholder until real payloads are measured. The current release payload is 3.1 MB.
3. **Preview smoke checks are manual.** They can move into CI once a release exists and the channel name is stable.
