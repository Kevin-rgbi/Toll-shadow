#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from pipeline.src.nyccas_quality import derive_quality  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser()
    for pollutant in ("ec", "nox", "pm", "o3"):
        parser.add_argument(f"--{pollutant}", type=Path, required=True)
    parser.add_argument("--nta", type=Path, required=True)
    parser.add_argument("--current-air", type=Path, required=True)
    parser.add_argument("--quality-out", type=Path, required=True)
    parser.add_argument("--neighborhood-out", type=Path, required=True)
    args = parser.parse_args()

    quality, neighborhood = derive_quality(
        {"EC": args.ec, "NOX": args.nox, "PM": args.pm, "O3": args.o3},
        args.nta,
        args.current_air,
    )
    args.quality_out.write_text(json.dumps(quality, indent=2) + "\n", encoding="utf-8")
    args.neighborhood_out.write_text(json.dumps(neighborhood, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
