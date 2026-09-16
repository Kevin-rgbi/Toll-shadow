import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CsvContractError } from '../src/csv.mjs';
import { TRAFFIC_TIME_BANDS, parseTrafficObservations, trafficDayType, trafficTimeBand } from '../src/traffic.mjs';

const fixture = (name) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);

async function collect(generator) {
  const results = [];
  for await (const item of generator) results.push(item);
  return results;
}

describe('parseTrafficObservations', () => {
  it('normalizes a valid contracted DOT observation without changing source geometry', async () => {
    await expect(collect(parseTrafficObservations(fixture('traffic-valid.csv')))).resolves.toEqual([
      expect.objectContaining({
        observedAt: '2025-01-05T08:15:00.000Z',
        volume: 1147,
        segmentId: 55135,
        direction: 'NB',
        fromStreet: null,
        sourceGeometry: expect.objectContaining({ crs: 'EPSG:2263', x: 1035363.4, y: 185093.4 }),
      }),
    ]);
  });

  it('rejects a negative traffic volume instead of silently coercing it', async () => {
    await expect(collect(parseTrafficObservations(fixture('traffic-negative-volume.csv')))).rejects.toBeInstanceOf(CsvContractError);
  });

  it('derives the day type and time band onto each observation', async () => {
    const [observation] = await collect(parseTrafficObservations(fixture('traffic-valid.csv')));

    // 2025-01-05 is a Sunday, 08:15 falls in the AM peak band.
    expect(observation.dayType).toBe('Weekend');
    expect(observation.timeBand).toBe('AM peak (06-09)');
  });
});

describe('reporting bands', () => {
  it('puts every hour of the day in exactly one band', () => {
    const hours = Array.from({ length: 24 }, (_, hour) => hour);
    const assigned = hours.map((hour) => trafficTimeBand(hour));

    expect(assigned.every((band) => TRAFFIC_TIME_BANDS.includes(band))).toBe(true);
    expect(new Set(assigned).size).toBe(TRAFFIC_TIME_BANDS.length);
  });

  it('places the boundaries in the documented bands', () => {
    expect(trafficTimeBand(0)).toBe('Overnight (22-06)');
    expect(trafficTimeBand(5)).toBe('Overnight (22-06)');
    expect(trafficTimeBand(6)).toBe('AM peak (06-09)');
    expect(trafficTimeBand(8)).toBe('AM peak (06-09)');
    expect(trafficTimeBand(9)).toBe('Midday (09-16)');
    expect(trafficTimeBand(15)).toBe('Midday (09-16)');
    expect(trafficTimeBand(16)).toBe('PM peak (16-19)');
    expect(trafficTimeBand(18)).toBe('PM peak (16-19)');
    expect(trafficTimeBand(19)).toBe('Evening (19-22)');
    expect(trafficTimeBand(21)).toBe('Evening (19-22)');
    expect(trafficTimeBand(22)).toBe('Overnight (22-06)');
  });

  it('treats Saturday and Sunday as weekend and the rest as weekday', () => {
    expect(trafficDayType('2025-01-04T12:00:00.000Z')).toBe('Weekend'); // Saturday
    expect(trafficDayType('2025-01-05T12:00:00.000Z')).toBe('Weekend'); // Sunday
    expect(trafficDayType('2025-01-06T12:00:00.000Z')).toBe('Weekday'); // Monday
    expect(trafficDayType('2025-01-10T12:00:00.000Z')).toBe('Weekday'); // Friday
  });
});
