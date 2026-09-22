import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const script = new URL('../scripts/derive-air-measurements.py', import.meta.url).pathname;

function fixture({ duplicate = false } = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'toll-shadow-air-'));
  const setup = path.join(directory, 'fixture.py');
  writeFileSync(setup, `
import csv, io, zipfile
from datetime import datetime, timedelta, timezone

out = ${JSON.stringify(path.join(directory, 'nyccas.zip'))}
rows = []
start = datetime(2025, 3, 9, 5, tzinfo=timezone.utc)
for i in range(18):
    stamp = start + timedelta(hours=i)
    rows.append([f'a-{i}', 'site-a', stamp.strftime('%Y-%m-%d %H:%M:%S'), '10'])
for i in range(17):
    stamp = start + timedelta(hours=i)
    rows.append([f'b-{i}', 'site-b', stamp.strftime('%Y-%m-%d %H:%M:%S'), '20'])
rows += [
    ['c-1', 'site-c', '2025-03-09 05:00:00', '30'],
    ['c-2', 'site-c', '2025-03-09 18:00:00', '32'],
]
${duplicate ? "rows.append(['dup', 'site-a', '2025-03-09 05:00:00', '11'])" : ''}

def csv_bytes(headers, values):
    output = io.StringIO()
    writer = csv.writer(output, lineterminator='\\n')
    writer.writerow(headers)
    writer.writerows(values)
    return output.getvalue()

with zipfile.ZipFile(out, 'w') as archive:
    archive.writestr('hist/csv/2025/3.csv', csv_bytes(['ID','SiteID','ObservationTimeUTC','Value'], rows))
    archive.writestr('hist/csv/location.csv', csv_bytes(
        ['SiteID','Latitude','Longitude','Location','Address','StartTime','EndTime'],
        [
            ['site-a','40.70','-74.00','Site A','A','2025-01-01 00:00',''],
            ['site-b','40.71','-74.01','Site B','B','2025-01-01 00:00',''],
            ['site-c','40.72','-74.02','Site C','C old','2025-01-01 00:00','2025-03-09 12:00'],
            ['site-c','40.73','-74.03','Site C','C new','2025-03-09 13:00',''],
        ]))
    archive.writestr('portal/station-new.csv', csv_bytes(
        ['SiteID','Location','loc_col','Latitude','Longitude'],
        [['site-a','Site A','A','40.70','-74.00'],['site-b','Site B','B','40.71','-74.01'],['site-c','Site C','C','40.73','-74.03']]))
`);
  execFileSync('python3', [setup]);
  return directory;
}

describe('NYCCAS measured-air derivation', () => {
  it('uses New York DST days, explicit null hours, and relocation-safe daily values', () => {
    const directory = fixture();
    const daily = path.join(directory, 'daily.csv');
    const hourly = path.join(directory, 'hourly.csv');
    const quality = path.join(directory, 'quality.json');

    execFileSync('python3', [script, '--archive', path.join(directory, 'nyccas.zip'), '--daily-out', daily, '--hourly-out', hourly, '--quality-out', quality]);

    const dailyText = readFileSync(daily, 'utf8');
    expect(dailyText).toContain('site-a,Site A,Unknown,40.7,-74.0,10.0,10.0,10.0,18,23,78.26,qualifying');
    expect(dailyText).toContain('site-b,Site B,Unknown,40.71,-74.01,,20.0,20.0,17,23,73.91,insufficient_hours');
    expect(dailyText).toContain('site-c,Site C,Unknown,40.72,-74.02,,31.0,32.0,2,23,8.7,monitor_relocated');

    const hourlyText = readFileSync(hourly, 'utf8');
    expect(hourlyText).toContain('2025-03-09T22:00:00Z,2025-03-09T18:00:00-04:00,site-b,Site B,Unknown,40.71,-74.01,,missing');
    expect(hourlyText).toContain('2025-03-09T18:00:00Z,2025-03-09T14:00:00-04:00,site-c,Site C,Unknown,40.73,-74.03');

    const report = JSON.parse(readFileSync(quality, 'utf8'));
    expect(report.archive).toBe('nyccas.zip');
    expect(report.raw_rows).toBe(37);
    expect(report.duplicate_site_hours).toBe(0);
    expect(report.daily.expected_hour_counts).toEqual({ '23': 3 });
    expect(report.daily.relocation_days).toBe(1);
  });

  it('rejects duplicate site and UTC-hour observations', () => {
    const directory = fixture({ duplicate: true });
    const result = spawnSync('python3', [script, '--archive', path.join(directory, 'nyccas.zip'), '--daily-out', path.join(directory, 'daily.csv'), '--hourly-out', path.join(directory, 'hourly.csv'), '--quality-out', path.join(directory, 'quality.json')], { encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('duplicate SiteID/ObservationTimeUTC');
  });
});
