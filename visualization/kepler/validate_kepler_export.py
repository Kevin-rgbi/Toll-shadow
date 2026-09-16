#!/usr/bin/env python3
"""Repeatable validity check for the Toll Shadow Kepler export.

Kepler is a source-side reproducibility and visual-QA artifact, not the public
runtime (React + MapLibre is). This script answers one narrow question:

    Does visualization/kepler/01_Traffic.json still embed exactly the declared
    legacy inputs, by file identity, schema, row count, and value?

It deliberately does NOT answer "are those inputs analytically approved". A
passing run means the export matches the inputs recorded in kepler_baseline.json
and the preserved CSVs under data/processed/. It says nothing about whether the
policy labels, hourly estimate, facility mapping, or coordinates are correct.

Usage (from the workspace root):
    python3 visualization/kepler/validate_kepler_export.py
    python3 visualization/kepler/validate_kepler_export.py --json
    python3 visualization/kepler/validate_kepler_export.py \
        --export visualization/kepler/01_Traffic.json \
        --processed-root data/processed

Exit codes: 0 = all checks passed, 1 = one or more checks failed,
2 = the validator could not run (missing input file or unreadable baseline).
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import sys
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_EXPORT = WORKSPACE_ROOT / "visualization" / "kepler" / "01_Traffic.json"
DEFAULT_BASELINE = WORKSPACE_ROOT / "visualization" / "kepler" / "kepler_baseline.json"
DEFAULT_PROCESSED_ROOT = WORKSPACE_ROOT / "data" / "processed"


class Report:
    """Collects check results; a single failure makes the whole run fail."""

    def __init__(self) -> None:
        self.results: list[dict] = []

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


def read_csv_rows(path: Path) -> tuple[list[str], list[list[str]]]:
    """Read a CSV with BOM tolerance. Returns (header, body_rows)."""
    text = path.read_bytes().decode("utf-8-sig", errors="replace")
    rows = list(csv.reader(io.StringIO(text)))
    if not rows:
        raise ValueError(f"{path} is empty")
    return rows[0], rows[1:]


def values_equal(left, right) -> bool:
    """Compare a CSV cell to an embedded Kepler cell.

    Kepler stores numbers as JSON numbers, so a CSV "40.688660" and an embedded
    40.68866 are the same value. Everything else must match as trimmed text.
    """
    a = str(left).strip()
    b = str(right).strip()
    if a == b:
        return True
    try:
        return float(a) == float(b)
    except (TypeError, ValueError):
        return False


def validate(export_path: Path, baseline_path: Path, processed_root: Path) -> Report:
    report = Report()
    baseline = json.loads(baseline_path.read_text())
    export = json.loads(export_path.read_text())

    expected = {entry["label"]: entry for entry in baseline["datasets"]}

    # --- Dataset inventory -------------------------------------------------
    datasets = export.get("datasets")
    if not isinstance(datasets, list):
        report.check("export.datasets is a list", False, "missing or wrong type")
        return report

    embedded = {}
    for entry in datasets:
        data = entry.get("data") if isinstance(entry, dict) else None
        if not isinstance(data, dict) or "label" not in data:
            report.check("every dataset has data.label", False, "malformed dataset entry")
            continue
        embedded[data["label"]] = data

    report.check(
        "dataset labels match the declared baseline set",
        set(embedded) == set(expected),
        f"embedded={sorted(embedded)} baseline={sorted(expected)}",
    )

    # --- Layer wiring ------------------------------------------------------
    layers = (
        export.get("config", {})
        .get("config", {})
        .get("visState", {})
        .get("layers", [])
    )
    dataset_ids = {data.get("id") for data in embedded.values()}
    dangling = [
        layer.get("id")
        for layer in layers
        if layer.get("config", {}).get("dataId") not in dataset_ids
    ]
    report.check(
        "every Kepler layer points at an embedded dataset",
        bool(layers) and not dangling,
        f"layers={len(layers)} dangling={dangling}",
    )

    # --- Per-dataset identity ---------------------------------------------
    for label, want in expected.items():
        data = embedded.get(label)
        if data is None:
            report.check(f"[{label}] embedded", False, "not present in export")
            continue

        rows = data.get("allData") or []
        fields = [f.get("name") for f in data.get("fields", [])]

        report.check(
            f"[{label}] kepler dataset id",
            data.get("id") == want["kepler_dataset_id"],
            f"got={data.get('id')} want={want['kepler_dataset_id']}",
        )
        report.check(
            f"[{label}] field names and order",
            fields == want["fields"],
            f"got={fields}",
        )
        report.check(
            f"[{label}] embedded row count",
            len(rows) == want["row_count"],
            f"got={len(rows)} want={want['row_count']}",
        )
        ragged = [i for i, row in enumerate(rows) if len(row) != len(fields)]
        report.check(
            f"[{label}] no ragged rows",
            not ragged,
            f"ragged row indexes={ragged[:5]}",
        )

        source = processed_root.parent.parent / want["source_path"]
        if not source.exists():
            source = WORKSPACE_ROOT / want["source_path"]
        if not source.exists():
            report.check(f"[{label}] declared source CSV exists", False, str(source))
            continue

        actual_sha = sha256_file(source)
        report.check(
            f"[{label}] source CSV sha256",
            actual_sha == want["sha256"],
            f"got={actual_sha} want={want['sha256']}",
        )

        header, body = read_csv_rows(source)
        report.check(
            f"[{label}] source CSV header matches baseline",
            header == want["fields"],
            f"got={header}",
        )
        report.check(
            f"[{label}] export row count equals source CSV row count",
            len(rows) == len(body),
            f"export={len(rows)} csv={len(body)}",
        )

        mismatches = 0
        first_mismatch = None
        for i, (csv_row, embedded_row) in enumerate(zip(body, rows)):
            for j, (a, b) in enumerate(zip(csv_row, embedded_row)):
                if not values_equal(a, b):
                    mismatches += 1
                    if first_mismatch is None:
                        first_mismatch = {
                            "row": i,
                            "column": header[j] if j < len(header) else j,
                            "csv": str(a)[:60],
                            "embedded": str(b)[:60],
                        }
                    break
        report.check(
            f"[{label}] embedded values equal source CSV values",
            mismatches == 0,
            f"mismatched rows={mismatches} first={first_mismatch}",
        )

    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--export", type=Path, default=DEFAULT_EXPORT)
    parser.add_argument("--baseline", type=Path, default=DEFAULT_BASELINE)
    parser.add_argument("--processed-root", type=Path, default=DEFAULT_PROCESSED_ROOT)
    parser.add_argument("--json", action="store_true", help="emit machine-readable output")
    args = parser.parse_args()

    for required in (args.export, args.baseline):
        if not required.exists():
            print(f"ERROR: required input missing: {required}", file=sys.stderr)
            return 2

    report = validate(args.export, args.baseline, args.processed_root)
    baseline = json.loads(args.baseline.read_text())

    if args.json:
        print(
            json.dumps(
                {
                    "export": str(args.export),
                    "passed": len(report.passed),
                    "failed": len(report.failed),
                    "results": report.results,
                    "claim_boundary": baseline["claim_boundary"],
                },
                indent=2,
            )
        )
        return 1 if report.failed else 0

    print(f"Kepler export validation: {args.export}")
    print(f"Baseline:                 {args.baseline}")
    print()
    for result in report.failed:
        print(f"  FAIL  {result['check']}")
        if result["detail"]:
            print(f"        {result['detail']}")
    print(f"\n{len(report.passed)} checks passed, {len(report.failed)} failed")
    print()
    print("Claim boundary: " + baseline["claim_boundary"])
    return 1 if report.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
