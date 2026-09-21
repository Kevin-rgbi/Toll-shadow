import { describe, expect, it } from 'vitest';
import { validateAirContext, validateEquityContext, validateHealthContext } from '../src/context.mjs';

/**
 * Contract tests for the published context assets.
 *
 * Each case here is a payload that a shape check alone would accept and that would then reach a
 * reader as wrong data or a blank module. The published asset and the browser parser have to agree
 * on all of them, so these assert the rejections, not the happy path.
 */

const healthRecord = (overrides = {}) => ({
  indicator: 'ED Visits',
  county: 'Bronx',
  borough: 'Bronx',
  period: '2005-2007',
  age_adjusted_rate_per_10000: 780.65,
  annual_age_adjusted_rate_per_10000: 260.218,
  events: 107326,
  daily_mean_events: 98.015,
  ...overrides,
});

const health = (records) => ({
  source: 'archived extract',
  geography_label: 'county',
  period_label: 'ending 2019',
  records,
});

const ring = [[-73.9, 40.8], [-73.8, 40.8], [-73.8, 40.9], [-73.9, 40.8]];

const feature = (geometry, properties = { GEOID: '36005000100', County: 'Bronx' }) => ({
  type: 'Feature',
  geometry,
  properties,
});

const equity = (features) => ({
  vintage: 'archived 2023',
  geography_label: 'tracts',
  aggregation: 'simplified for display',
  features,
});

describe('validateHealthContext', () => {
  it('accepts a fractional rate next to a whole event count', () => {
    expect(validateHealthContext(health([healthRecord()])).records).toBe(1);
  });

  it('rejects a fractional event count, which the browser parser would refuse', () => {
    expect(() => validateHealthContext(health([healthRecord({ events: 107326.5 })])))
      .toThrow(/events must be a whole count/);
  });

  it('rejects a negative rate', () => {
    expect(() => validateHealthContext(health([healthRecord({ age_adjusted_rate_per_10000: -1 })])))
      .toThrow(/must not be negative/);
  });
});

describe('validateEquityContext', () => {
  it('accepts a well-formed polygon', () => {
    expect(validateEquityContext(equity([feature({ type: 'Polygon', coordinates: [ring] })])).features).toBe(1);
  });

  it('accepts a multipolygon', () => {
    const multi = { type: 'MultiPolygon', coordinates: [[ring]] };
    expect(validateEquityContext(equity([feature(multi)])).features).toBe(1);
  });

  it('rejects coordinates that are not rings', () => {
    // An array of anything satisfies a shape check, and the renderer then projects a string.
    expect(() => validateEquityContext(equity([feature({ type: 'Polygon', coordinates: ['bad'] })])))
      .toThrow(/ring of at least 3 positions/);
  });

  it('rejects a ring with fewer than three positions', () => {
    expect(() => validateEquityContext(equity([feature({ type: 'Polygon', coordinates: [[[-73.9]]] })])))
      .toThrow(/ring of at least 3 positions/);
  });

  it('rejects a position that is not a coordinate pair', () => {
    // Three positions, so it passes the ring-length check and has to fail on the position itself.
    const short = { type: 'Polygon', coordinates: [[[-73.9], [-73.8, 40.8], [-73.8, 40.9]]] };
    expect(() => validateEquityContext(equity([feature(short)]))).toThrow(/must be a \[lng, lat\] pair/);
  });

  it('rejects a coordinate that is not a finite number', () => {
    const bad = { type: 'Polygon', coordinates: [[[-73.9, 'x'], [-73.8, 40.8], [-73.8, 40.9]]] };
    expect(() => validateEquityContext(equity([feature(bad)]))).toThrow(/must be a finite number/);
  });

  it('rejects an empty ring', () => {
    expect(() => validateEquityContext(equity([feature({ type: 'Polygon', coordinates: [[]] })])))
      .toThrow(/ring of at least 3 positions/);
  });
});

describe('validateAirContext', () => {
  const air = (overrides = {}) => ({
    pollutant_label: 'black carbon (inferred)',
    period_label: '2016 (inferred)',
    values: 'relative 0-1',
    aggregation: '2x2 mean',
    bounds: [-74.26, 40.49, -73.69, 40.92],
    width: 2,
    height: 2,
    grid: [[0.0, 0.5], [null, 1.0]],
    ...overrides,
  });

  it('accepts a grid with a masked cell', () => {
    expect(validateAirContext(air()).height).toBe(2);
  });

  it('rejects a value outside the relative range', () => {
    expect(() => validateAirContext(air({ grid: [[0.0, 12.5], [null, 1.0]] })))
      .toThrow(/between 0 and 1/);
  });

  it('rejects a grid whose rows do not match the declared height', () => {
    expect(() => validateAirContext(air({ grid: [[0.0, 0.5]] }))).toThrow(/2 rows/);
  });

  it('rejects a non-integer dimension', () => {
    expect(() => validateAirContext(air({ width: 2.5 }))).toThrow(/width and height must be integers/);
  });
});
