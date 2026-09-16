import { describe, expect, it } from 'vitest';
import { epsg2263ToWgs84 } from '../src/geospatial.mjs';

describe('epsg2263ToWgs84', () => {
  it('transforms a retained DOT point into New York City WGS84 bounds', () => {
    expect(epsg2263ToWgs84({ x: 995814.8, y: 215897.4 })).toEqual({
      longitude: expect.closeTo(-73.95825499713075, 8),
      latitude: expect.closeTo(40.75925736275574, 8),
    });
  });
});
