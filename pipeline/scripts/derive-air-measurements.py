#!/usr/bin/env python3
"""Derive release-ready hourly and NYC-local daily NYCCAS PM2.5 CSVs."""

from __future__ import annotations

import argparse
import csv
import io
import json
import math
import zipfile
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

NYC = ZoneInfo("America/New_York")
UTC = timezone.utc
BOROUGHS = {"36005": "Bronx", "36047": "Brooklyn", "36061": "Manhattan", "36081": "Queens", "36085": "Staten Island"}
QUALITY = "Preliminary; subject to revision"


@dataclass(frozen=True)
class Episode:
    site_id: str
    latitude: float
    longitude: float
    name: str
    address: str
    start: datetime
    end: datetime | None

    def active(self, stamp: datetime) -> bool:
        return self.start <= stamp and (self.end is None or stamp <= self.end)


def parse_utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed.astimezone(UTC)


def read_csv(archive: zipfile.ZipFile, name: str) -> list[dict[str, str]]:
    with archive.open(name) as raw:
        return list(csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")))


def iso_utc(value: datetime) -> str:
    return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def borough(site_id: str) -> str:
    return BOROUGHS.get(site_id[:5], "Unknown")


def episode_at(episodes: list[Episode], stamp: datetime) -> Episode | None:
    matches = [episode for episode in episodes if episode.active(stamp)]
    if len(matches) > 1:
        raise ValueError(f"overlapping location episodes for {episodes[0].site_id} at {iso_utc(stamp)}")
    return matches[0] if matches else None


def derive(archive_path: Path, daily_path: Path, hourly_path: Path, quality_path: Path) -> None:
    with zipfile.ZipFile(archive_path) as archive:
        names = set(archive.namelist())
        def member(suffix: str) -> str | None:
            matches = [name for name in names if name == suffix or name.endswith(f"/{suffix}")]
            return matches[0] if len(matches) == 1 else None

        location_file = member("hist/csv/location.csv")
        station_file = member("portal/station-new.csv")
        month_files = sorted(
            name for name in names
            if any(f"/hist/csv/{year}/" in f"/{name}" for year in ("2025", "2026")) and name.endswith(".csv")
        )
        if not month_files or location_file is None or station_file is None:
            raise ValueError("archive must contain monthly observations, location.csv, and station-new.csv")

        locations: dict[str, list[Episode]] = defaultdict(list)
        for row in read_csv(archive, location_file):
            start = datetime.strptime(row["StartTime"].strip(), "%Y-%m-%d %H:%M").replace(tzinfo=UTC)
            end_text = row["EndTime"].strip()
            end = datetime.strptime(end_text, "%Y-%m-%d %H:%M").replace(tzinfo=UTC) if end_text else None
            locations[row["SiteID"].strip()].append(Episode(
                row["SiteID"].strip(), float(row["Latitude"]), float(row["Longitude"]),
                row["Location"].strip(), row["Address"].strip(), start, end,
            ))
        for episodes in locations.values():
            episodes.sort(key=lambda item: item.start)

        observations: dict[tuple[str, datetime], float] = {}
        for name in month_files:
            for row in read_csv(archive, name):
                site_id = row["SiteID"].strip()
                stamp = parse_utc(row["ObservationTimeUTC"])
                key = (site_id, stamp)
                if key in observations:
                    raise ValueError(f"duplicate SiteID/ObservationTimeUTC: {site_id} {iso_utc(stamp)}")
                value = float(row["Value"])
                if not math.isfinite(value) or value < 0:
                    raise ValueError(f"invalid PM2.5 value for {site_id} {iso_utc(stamp)}")
                if episode_at(locations.get(site_id, []), stamp) is None:
                    raise ValueError(f"no active location for {site_id} {iso_utc(stamp)}")
                observations[key] = value

    sites = sorted({site_id for site_id, _ in observations})
    observations_by_site: dict[str, list[tuple[datetime, float]]] = defaultdict(list)
    for (site_id, observed_at), value in observations.items():
        observations_by_site[site_id].append((observed_at, value))
    for rows in observations_by_site.values():
        rows.sort()
    first = min(stamp for _, stamp in observations)
    last = max(stamp for _, stamp in observations)
    hourly_rows: list[list[object]] = []
    stamp = first
    missing = 0
    while stamp <= last:
        local = stamp.astimezone(NYC)
        for site_id in sites:
            episode = episode_at(locations[site_id], stamp)
            if episode is None:
                continue
            value = observations.get((site_id, stamp))
            if value is None:
                missing += 1
            hourly_rows.append([
                iso_utc(stamp), local.isoformat(timespec="seconds"), site_id, episode.name,
                borough(site_id), episode.latitude, episode.longitude,
                "" if value is None else value, "missing" if value is None else QUALITY,
                f"Official location history: {episode.address}",
            ])
        stamp += timedelta(hours=1)

    local_start = first.astimezone(NYC).date()
    local_end = last.astimezone(NYC).date()
    daily_rows: list[list[object]] = []
    statuses = Counter()
    expected_counts = Counter()
    day = local_start
    while day <= local_end:
        local_midnight = datetime(day.year, day.month, day.day, tzinfo=NYC)
        next_midnight = local_midnight + timedelta(days=1)
        start_utc = local_midnight.astimezone(UTC)
        end_utc = next_midnight.astimezone(UTC)
        expected = int((end_utc - start_utc).total_seconds() // 3600)
        threshold = math.ceil(expected * 0.75)
        for site_id in sites:
            active = [episode for episode in locations[site_id] if episode_at([episode], start_utc) or episode_at([episode], end_utc - timedelta(seconds=1))]
            if not active:
                continue
            expected_counts[str(expected)] += 1
            observed = [(stamp, value) for stamp, value in observations_by_site[site_id] if start_utc <= stamp < end_utc]
            used_episodes = {episode_at(locations[site_id], item[0]) for item in observed}
            used_episodes.discard(None)
            relocated = len(active) > 1 or len(used_episodes) > 1
            values = [value for _, value in observed]
            valid = len(values)
            coverage = round(valid / expected * 100, 2)
            representative = episode_at(locations[site_id], start_utc) or active[0]
            if relocated:
                status = "monitor_relocated"
                mean = ""
            elif valid >= threshold:
                status = "qualifying"
                mean = round(sum(values) / valid, 4)
            elif valid == 0:
                status = "no_data"
                mean = ""
            else:
                status = "insufficient_hours"
                mean = ""
            statuses[status] += 1
            daily_rows.append([
                iso_utc(start_utc), day.isoformat(), day.year, day.month, site_id, representative.name,
                borough(site_id), representative.latitude, representative.longitude, mean,
                round(sum(values) / valid, 4) if values else "", max(values) if values else "",
                valid, expected, coverage, status, QUALITY,
                "Monitor changed location during this local calendar day; daily mean withheld." if relocated else "",
            ])
        day += timedelta(days=1)

    daily_path.parent.mkdir(parents=True, exist_ok=True)
    hourly_path.parent.mkdir(parents=True, exist_ok=True)
    with daily_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["timestamp_utc","date_nyc","year","month","site_id","site_name","borough","latitude","longitude","pm25_daily_mean_ugm3","pm25_observed_mean_ugm3","pm25_hourly_max_ugm3","valid_hours","expected_hours","coverage_pct","coverage_status","quality_status","location_note"])
        writer.writerows(daily_rows)
    with hourly_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["timestamp_utc","timestamp_nyc","site_id","site_name","borough","latitude","longitude","pm25_ugm3","quality_status","location_note"])
        writer.writerows(hourly_rows)

    report = {
        "archive": archive_path.name, "raw_rows": len(observations), "duplicate_site_hours": 0,
        "sites": len(sites), "coverage": {"start_utc": iso_utc(first), "end_utc": iso_utc(last)},
        "hourly": {"rows": len(hourly_rows), "observed": len(observations), "missing": missing},
        "daily": {"rows": len(daily_rows), "statuses": dict(statuses), "relocation_days": statuses["monitor_relocated"], "expected_hour_counts": dict(expected_counts)},
        "coverage_rule": "At least 75% of expected America/New_York local-day hours (18/23, 18/24, or 19/25).",
    }
    quality_path.parent.mkdir(parents=True, exist_ok=True)
    quality_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--daily-out", type=Path, required=True)
    parser.add_argument("--hourly-out", type=Path, required=True)
    parser.add_argument("--quality-out", type=Path, required=True)
    args = parser.parse_args()
    derive(args.archive, args.daily_out, args.hourly_out, args.quality_out)


if __name__ == "__main__":
    main()
