# Firebase Hosting Preview and Rollback Runbook

**Owner:** Agent 3
**Status:** executed and rehearsed. Production serves release `2026-09-20.4`, deployed 2026-09-20 after a green gate. The rollback section below was rehearsed on preview channel `p10-rehearsal` on 2026-09-20 against the installed CLI, which is how the two non-existent commands it used to name were found. The steps below are the standing procedure.


This runbook is the only approved path from a candidate build to `tollshallow.web.app`. Its purpose is that hosting never conceals an invalid data release: every step before a channel deploy is a gate, and a failed gate stops the run.

## Verified target facts (re-checked 2026-09-15)

| Fact | Value | How it was verified |
|---|---|---|
| Firebase account project count | 1 project | `firebase projects:list` (CLI, authenticated) |
| Project display name / ID | `TollShallow` / `tollshallow` | `firebase projects:list` |
| Project number | `1094344081770` | `firebase projects:list` |
| Default Hosting site | `tollshallow` — `https://tollshallow.web.app` | `firebase hosting:sites:list --project tollshallow` |
| Plural `tollshallows` | not accessible to this account — HTTP 403 | `firebase hosting:sites:list --project tollshallows` |
| Current singular site state | HTTP 200, serving release `2026-09-20.4` | `curl https://tollshallow.web.app/data/manifest.json` |
| Current plural site state | HTTP 200, unrelated page (636 bytes) | `curl https://tollshallows.web.app/` |

The repository `.firebaserc` previously named the plural project. It now names `tollshallow`; see "Configuration change" below.

**Do not treat a new candidate as deployed.** The singular site is serving, but every future release still needs the preview and smoke checks below.

## Preconditions (all must hold)

1. Agent 1 has published a validated release with a manifest, asset checksums, coverage, and limitations.
2. Agent 2 has produced a fresh production build from that release; `npm run lint`, `npm run test`, and `npm run build` pass for the current commit.
3. `visualization/kepler/validate_kepler_export.py` passes (Kepler stays a research artifact; it must not be mistaken for the runtime).
4. The release acceptance gate passes — see step 2. **A red gate is a hard stop.**
5. Deployment authority is recorded: only Agent 3 runs hosting commands, and production promotion requires an explicit owner release-approval handoff.

## Steps

### 1. Build the candidate

```bash
cd <repo>
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

Expected cache behavior from `firebase.json`: `/` and `data/manifest.json` → `no-cache, max-age=0, must-revalidate`; `/data/releases/**` and hashed JS/CSS/woff2 → `max-age=31536000, immutable`; images, XML and text → `max-age=3600`. There is no blanket `/data/**` rule.

Confirm the manifest served in the preview is the release built in step 1 — compare `release_id` and the asset `sha256` values against the gate output. A preview that serves a different release is a stop condition.

### 5. Promote to production (owner approval required)

Promotion is a separate, explicitly approved action. Before running it, confirm: preview verified in step 4, owner signoff recorded, and no open gate failures.

```bash
firebase deploy --only hosting --project tollshallow
```

Then re-run the smoke checks against `https://tollshallow.web.app/` and record the result. The candidate is only considered live after this step returns the expected release pointer and SPA shell.

## Rollback

**Rehearsed 2026-09-20 on preview channel `p10-rehearsal`. Production was not touched.**

Rollback is a Hosting-level operation; it does not roll back data. Because published releases are
immutable, a bad data release is corrected by publishing a new release ID and a new manifest pointer —
never by patching a published asset in place.

The commands in this section were re-verified against the installed `firebase-tools` **15.30**. The
earlier revision of this runbook named `firebase hosting:releases:list` and `firebase hosting:channels:delete`,
and neither exists in that version:

```
$ npx firebase hosting:releases:list --project tollshallow
Error: hosting:releases:list is not a Firebase command
$ npx firebase hosting:channels:delete <channel-id> --project tollshallow
Error: hosting:channels:delete is not a Firebase command
```

The Hosting command surface in this version is `hosting:clone`, `hosting:disable`, `hosting:channel`,
and `hosting:sites`. There is **no CLI rollback command**: rolling the live site back to a previous
release version is done in the Firebase console (Hosting → Release history → Rollback). Treat that as
the only in-place restore path, and treat the redeploy path below as the rehearsed one.

### Rehearsed procedure

```bash
# 1. deploy a candidate to its own channel
npx firebase hosting:channel:deploy <release-id> --project tollshallow --expires 7d

# 2. confirm the channel serves the release you built (step 4 smoke checks)
# 3. redeploy to the same channel with the corrected artifact
npx firebase hosting:channel:deploy <release-id> --project tollshallow --expires 7d

# 4. confirm the channel now serves the corrected artifact
# 5. remove the channel
npx firebase hosting:channel:delete <channel-id> --project tollshallow --force

# 6. roll the live site back: Firebase console, Hosting -> Release history -> Rollback,
#    or redeploy the previous artifact with step 5 of this runbook
```

Observed during the rehearsal, in order:

| Step | Action | Observed result |
|---|---|---|
| 1 | `hosting:channel:deploy p10-rehearsal` | Channel URL issued; `release_id 2026-09-20.3`, `status validated`, 6 assets |
| 2 | smoke checks | `/` served the shell; `data/manifest.json` → `no-cache, max-age=0, must-revalidate`; `/data/releases/**/*.geojson` → `HTTP/2 200`, `public, max-age=31536000, immutable` |
| 3 | redeploy with a marker comment in `index.html` | Channel served the marker: **1** occurrence |
| 4 | redeploy with the marker removed | Channel served the marker: **0** occurrences — the same channel replaced its content in both directions |
| 5 | production checked throughout | Marker present: **0**; production kept serving `2026-09-20.3` |
| 6 | `hosting:channel:delete p10-rehearsal --force` | `Successfully deleted channel`; channel URL then returned **404**, production still **200** |

Two things this establishes, and one it does not:

- A preview channel can be updated in place, and an earlier artifact can be restored by redeploying
  it. That is the motion a rollback needs, and it was observed rather than assumed.
- Deleting a channel stops serving it without touching the live site.
- It does **not** rehearse the console rollback of the live channel, because that operation acts on
  production by definition. Nobody should run it as a drill.

After any rollback: re-run the step 4 smoke checks, record which release the live site is serving, and
note the incident in the log.

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
2. **Asset budget is sized to the merged branch, not surveyed.** The gate's 64 MiB `dist/data` ceiling keeps the unified `2026-09-21.1` candidate buildable; its eight assets total about 52.2 MiB, with the 46.9 MB hourly AIR file loaded on demand. Re-derive the ceiling when a larger release is proposed.
3. **Preview-channel smoke checks are still manual.** The application itself now has an end-to-end suite in CI (`npm run test:e2e`, 66 tests) that covers the shell, deep links, filters, measured AIR, the phone sheet, and the failure states, but nothing in CI deploys or probes a channel. Steps 4 and 5 stay manual until a release job exists.
