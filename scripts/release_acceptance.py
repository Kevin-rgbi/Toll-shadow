#!/usr/bin/env python3
"""Release acceptance gate for the Toll Shadow Firebase Hosting lane.

Hosting must never conceal an invalid data release. This gate runs *before* any
`firebase hosting:channel:deploy` or `firebase deploy` and refuses a candidate
build that is missing, synthetic, untraceable, oversized, or pointed at the
wrong Firebase project.

It is a blocking gate, not a report: any failed check exits non-zero, and the
deployment runbook requires a green run before a preview channel is created.

Usage (from the repository root, after `npm run build`):
    python3 scripts/release_acceptance.py
    python3 scripts/release_acceptance.py --json
    python3 scripts/release_acceptance.py --dist dist --budget-bytes 8388608

Exit codes: 0 = release accepted, 1 = release rejected, 2 = gate could not run.

Deliberately NOT checked here (owned elsewhere):
  - claim-lint for "caused"/"expected"/"impact" copy      -> A3 + Agent 2
  - manifest schema authorship                            -> Agent 1 contracts
  - live HTTP smoke test of the preview channel           -> runbook step 5
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
EXPECTED_PROJECT = "tollshallow"
EXPECTED_PROJECT_NUMBER = "1094344081770"

# Provisional browser-asset budget for dist/data. docs/ARCHITECTURE.md and
# docs/DATA_STRATEGY.md require a budget but do not fix a number; A7 measures
# real payloads. Until that measurement lands this gate uses 8 MiB for the
# whole data directory as a conservative ceiling, and it is expected to be
# tightened after A7 profiling.
DEFAULT_BUDGET_BYTES = 8 * 1024 * 1024

# Raw/archive payloads that must never ship to the browser.
RAW_PAYLOAD_SUFFIXES = (".csv", ".tif", ".adf", ".zip", ".pdf", ".xls", ".xlsx")

REQUIRED_MANIFEST_FIELDS = (
    "release_id",
    "schema_version",
    "source_ids",
    "transform_version",
    "coverage",
    "limitations",
)

SECRET_PATTERNS = (
    # Google/Firebase browser API key. Note: a Firebase web API key is public by
    # design, so a hit here means "check whether this belongs in a data asset",
    # not "leak confirmed".
    re.compile(r"AIza[0-9A-Za-z_\-]{35}"),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    # JSON puts keys in quotes ("token": "..."), so the closing quote must be
    # optional here; an unquoted-only pattern silently misses the common case.
    re.compile(
        r"(?i)\b(api[_-]?key|secret|password|token|credential)\b[\"']?\s*[:=]\s*[\"'][^\"']{16,}[\"']"
    ),
)


class Gate:
    def __init__(self) -> None:
        self.results: list[dict] = []
        self.notes: list[str] = []

    def check(self, name: str, ok: bool, detail: str = "") -> bool:
        self.results.append({"check": name, "ok": bool(ok), "detail": detail})
        return bool(ok)

    @property
    def failed(self) -> list[dict]:
        return [r for r in self.results if not r["ok"]]

    @property
    def passed(self) -> list[dict]:
        return [r for r in self.results if r["ok"]]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def walk_json(node):
    """Yield every (path, key, value) triple in a nested JSON structure."""
    if isinstance(node, dict):
        for key, value in node.items():
            yield (key, value)
            yield from walk_json(value)
    elif isinstance(node, list):
        for item in node:
            yield from walk_json(item)


def collect_asset_entries(manifest: dict) -> list[dict]:
    """Normalize manifest asset declarations to a list of dicts.

    Accepts `assets: [{path|url, sha256?}]` (DATA_STRATEGY published-asset
    contract), a `files: {name: url}` pointer map, or a single `asset`.
    Agent 1 owns the final shape; this gate tolerates the documented variants
    so it fails on substance rather than on layout.
    """
    entries: list[dict] = []
    assets = manifest.get("assets")
    if isinstance(assets, list):
        for item in assets:
            if isinstance(item, dict):
                entries.append(item)
    if isinstance(manifest.get("asset"), dict):
        entries.append(manifest["asset"])
    files = manifest.get("files")
    if isinstance(files, list):
        for item in files:
            if isinstance(item, dict):
                entries.append(item)
    return entries


def gate(repo_root: Path, dist: Path, budget_bytes: int, dist_overridden: bool = False) -> Gate:
    result = Gate()

    # --- 1. Firebase target ------------------------------------------------
    firebaserc_path = repo_root / ".firebaserc"
    if result.check(".firebaserc exists", firebaserc_path.exists(), str(firebaserc_path)):
        firebaserc = json.loads(firebaserc_path.read_text())
        project = firebaserc.get("projects", {}).get("default")
        result.check(
            "default Firebase project is the confirmed singular project",
            project == EXPECTED_PROJECT,
            f"got={project!r} expected={EXPECTED_PROJECT!r} "
            f"(project number {EXPECTED_PROJECT_NUMBER})",
        )

    firebase_json_path = repo_root / "firebase.json"
    if result.check("firebase.json exists", firebase_json_path.exists(), str(firebase_json_path)):
        firebase_json = json.loads(firebase_json_path.read_text())
        hosting = firebase_json.get("hosting", {})
        result.check(
            "firebase.json declares a hosting block",
            bool(hosting),
            f"keys={sorted(firebase_json)}",
        )
        public_dir = (repo_root / str(hosting.get("public", ""))).resolve()
        if dist_overridden:
            # Fixture/CI runs may point --dist elsewhere; the mismatch is then
            # expected, so record it instead of blocking the gate.
            result.notes.append(
                f"hosting public dir ({public_dir}) differs from the overridden "
                f"--dist ({dist.resolve()}); target-match check skipped"
            )
        else:
            result.check(
                "hosting public dir matches the gate dist dir",
                public_dir == dist.resolve(),
                f"firebase.json={public_dir} gate={dist.resolve()}",
            )
        result.check(
            "hosting rewrites serve the SPA entry",
            any(r.get("destination") == "/index.html" for r in hosting.get("rewrites", [])),
            f"rewrites={hosting.get('rewrites')}",
        )

        # Cache policy. A release asset is immutable by path, so it may be cached indefinitely; the
        # release pointer must not be, or clients would never discover a new release.
        cache_controls = {
            rule.get("source"): {
                header.get("key", "").lower(): header.get("value", "")
                for header in rule.get("headers", [])
                if isinstance(header, dict)
            }
            for rule in hosting.get("headers", [])
            if isinstance(rule, dict)
        }

        manifest_cache = cache_controls.get("/data/manifest.json", {}).get("cache-control", "")
        result.check(
            "release pointer is served without long-lived caching",
            "no-cache" in manifest_cache or "max-age=0" in manifest_cache,
            f"Cache-Control={manifest_cache!r} for /data/manifest.json",
        )

        # The SPA shell is reached at "/" (deep links carry query strings, not paths), so a rule that
        # only covers "/index.html" leaves the entry point on Firebase's 3600 s default and can hide a
        # new release for an hour.
        root_cache = cache_controls.get("/", {}).get("cache-control", "")
        result.check(
            "SPA entry at / is served without long-lived caching",
            "no-cache" in root_cache or "max-age=0" in root_cache,
            f"Cache-Control={root_cache!r} for /",
        )

        # A catch-all rewrite turns every missing file into a 200 with the SPA shell, which hides
        # broken asset paths from both reviewers and crawlers. Only "/" should rewrite.
        rewrites = hosting.get("rewrites", [])
        result.check(
            "no catch-all rewrite, so a missing file returns 404",
            not any(rule.get("source") in ("**", "**/*") for rule in rewrites),
            f"rewrites={[rule.get('source') for rule in rewrites]}",
        )

        # Security headers on every response.
        security = cache_controls.get("**", {})
        required_headers = (
            "content-security-policy",
            "x-content-type-options",
            "referrer-policy",
            "x-frame-options",
            "permissions-policy",
        )
        missing_headers = [name for name in required_headers if name not in security]
        result.check(
            "security headers are declared for all responses",
            not missing_headers,
            f"missing={missing_headers}",
        )

        policy = security.get("content-security-policy", "")
        weak = [token for token in ("unsafe-eval", "unsafe-inline'", "'unsafe-inline") if token in policy and "script-src" in policy.split("style-src")[0]]
        result.check(
            "content security policy does not relax script execution",
            "unsafe-eval" not in policy and "unsafe-inline" not in policy.split("style-src")[0],
            f"script-src region contains unsafe directives: {weak}",
        )

        release_cache = cache_controls.get("/data/releases/**", {}).get("cache-control", "")
        result.check(
            "release assets are cached immutably by release path",
            "immutable" in release_cache,
            f"Cache-Control={release_cache!r} for /data/releases/**",
        )

    # --- 2. Build output ---------------------------------------------------
    index_html = dist / "index.html"
    if not result.check("built index.html exists", index_html.is_file(), str(index_html)):
        result.check("build is present", False, "run `npm run build` before this gate")
        return result

    manifest_path = dist / "data" / "manifest.json"
    if not result.check(
        "built release manifest exists at data/manifest.json",
        manifest_path.is_file(),
        str(manifest_path),
    ):
        return result

    try:
        manifest = json.loads(manifest_path.read_text())
    except json.JSONDecodeError as exc:
        result.check("release manifest parses as JSON", False, str(exc))
        return result
    result.check("release manifest parses as JSON", True, "")

    # --- 3. No synthetic data on the production path ----------------------
    synthetic_hits = [
        key for key, value in walk_json(manifest) if key == "synthetic" and value is True
    ]
    result.check(
        "manifest is not marked synthetic anywhere",
        not synthetic_hits,
        f"synthetic: true found at {len(synthetic_hits)} location(s)",
    )

    status = manifest.get("status")
    result.check(
        "release status is validated",
        status == "validated",
        f"got={status!r} expected='validated'",
    )

    # --- 4. Required release metadata -------------------------------------
    missing = [field for field in REQUIRED_MANIFEST_FIELDS if not manifest.get(field)]
    result.check(
        "manifest declares all required release fields",
        not missing,
        f"missing={missing}",
    )

    coverage = manifest.get("coverage")
    if isinstance(coverage, dict):
        result.check(
            "manifest coverage has start and end",
            bool(coverage.get("start")) and bool(coverage.get("end")),
            f"coverage={coverage}",
        )
    else:
        result.check("manifest coverage has start and end", False, f"coverage={coverage!r}")

    # --- 5. Asset traceability -------------------------------------------
    asset_entries = collect_asset_entries(manifest)
    result.check(
        "manifest declares at least one asset",
        bool(asset_entries),
        f"entries={len(asset_entries)}",
    )

    for entry in asset_entries:
        raw_url = entry.get("path") or entry.get("url") or ""
        label = raw_url or "<unlabeled asset>"
        if not raw_url:
            result.check("asset entry has a path or url", False, json.dumps(entry)[:120])
            continue

        rel = raw_url.split("?", 1)[0].lstrip("/")
        asset_path = (dist / rel).resolve()
        if not result.check(f"asset file exists: {label}", asset_path.is_file(), str(asset_path)):
            continue

        declared = entry.get("sha256")
        if declared:
            actual = sha256_file(asset_path)
            result.check(
                f"asset sha256 matches: {label}",
                actual == declared,
                f"got={actual} want={declared}",
            )
        else:
            result.check(
                f"asset declares a sha256: {label}",
                False,
                "every published asset must carry a checksum (DATA_STRATEGY)",
            )

    # --- 5b. Exactly one published release --------------------------------
    # Superseded release directories must not keep shipping: they double the deployed payload and
    # no pointer serves them. Canonical copies live under data/releases/ outside the build.
    releases_root = dist / "data" / "releases"
    if releases_root.is_dir():
        published_releases = sorted(entry.name for entry in releases_root.iterdir() if entry.is_dir())
        declared_release = manifest.get("release_id")
        result.check(
            "exactly one release is published, and it is the one the pointer serves",
            published_releases == [declared_release],
            f"published={published_releases} pointer={declared_release!r}",
        )
    else:
        result.check("a published release directory exists", False, str(releases_root))

    # --- 5c. Files a public site is expected to serve ---------------------
    required_site_files = (
        "robots.txt",
        "sitemap.xml",
        "404.html",
        "site.webmanifest",
        "security.txt",
        "og.png",
        "apple-touch-icon.png",
        "favicon.svg",
    )
    missing_site = [name for name in required_site_files if not (dist / name).is_file()]
    result.check(
        "site files are present in the build",
        not missing_site,
        f"missing={missing_site}",
    )

    robots = (dist / "robots.txt")
    if robots.is_file():
        body = robots.read_text()
        result.check(
            "robots.txt points at the sitemap",
            "Sitemap:" in body and "/sitemap.xml" in body,
            f"robots.txt={body.strip()[:120]!r}",
        )

    index = (dist / "index.html").read_text()
    for marker, label in (
        ('rel="canonical"', "canonical link"),
        ('property="og:image"', "open graph image"),
        ('application/ld+json', "structured data"),
        ("<noscript>", "no-JavaScript fallback"),
    ):
        result.check(f"index.html declares the {label}", marker in index, f"marker {marker!r} not found")

    # --- 6. No raw/archive payloads and no secrets ------------------------
    data_root = dist / "data"
    if data_root.is_dir():
        offenders = [
            str(p.relative_to(dist))
            for p in data_root.rglob("*")
            if p.is_file() and p.suffix.lower() in RAW_PAYLOAD_SUFFIXES
        ]
        result.check(
            "no raw/archive payloads under dist/data",
            not offenders,
            f"offenders={offenders[:10]}",
        )

        total = sum(p.stat().st_size for p in data_root.rglob("*") if p.is_file())
        result.check(
            "dist/data stays within the browser asset budget",
            total <= budget_bytes,
            f"total={total} budget={budget_bytes}",
        )
    else:
        result.check("dist/data directory exists", False, str(data_root))

    env_leaks = [str(p.relative_to(dist)) for p in dist.rglob(".env*")]
    result.check("no .env files are published", not env_leaks, f"found={env_leaks}")

    scan_targets = [manifest_path] + sorted(
        p for p in data_root.rglob("*") if p.is_file() and p.suffix.lower() in (".json", ".geojson")
    )
    secret_hits = []
    for path in scan_targets:
        try:
            text = path.read_text(errors="replace")
        except OSError:
            continue
        for pattern in SECRET_PATTERNS:
            if pattern.search(text):
                secret_hits.append(str(path.relative_to(dist)))
                break
    result.check(
        "no credentials in published data assets",
        not secret_hits,
        f"hits={secret_hits[:10]}",
    )

    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Toll Shadow release acceptance gate")
    parser.add_argument("--repo-root", type=Path, default=REPO_ROOT)
    parser.add_argument("--dist", type=Path, default=None, help="defaults to <repo-root>/dist")
    parser.add_argument("--budget-bytes", type=int, default=DEFAULT_BUDGET_BYTES)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    repo_root = args.repo_root.resolve()
    dist = (args.dist or repo_root / "dist").resolve()

    if not repo_root.is_dir():
        print(f"ERROR: repo root not found: {repo_root}", file=sys.stderr)
        return 2

    result = gate(repo_root, dist, args.budget_bytes, dist_overridden=args.dist is not None)

    if args.json:
        print(
            json.dumps(
                {
                    "repo_root": str(repo_root),
                    "dist": str(dist),
                    "budget_bytes": args.budget_bytes,
                    "passed": len(result.passed),
                    "failed": len(result.failed),
                    "results": result.results,
                    "notes": result.notes,
                },
                indent=2,
            )
        )
        return 1 if result.failed else 0

    print(f"Release acceptance gate: {dist}")
    for item in result.failed:
        print(f"  REJECT  {item['check']}")
        if item["detail"]:
            print(f"          {item['detail']}")
    for note in result.notes:
        print(f"  NOTE    {note}")
    print(f"\n{len(result.passed)} checks passed, {len(result.failed)} failed")
    if result.failed:
        print("\nRELEASE REJECTED — do not deploy to a preview channel or production.")
    else:
        print("\nRELEASE ACCEPTED — proceed to the preview-channel runbook.")
    return 1 if result.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
