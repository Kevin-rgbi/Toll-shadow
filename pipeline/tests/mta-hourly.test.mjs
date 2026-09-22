import { describe, expect, it } from 'vitest';
import { normalizeHourlyCrossingAggregates } from '../src/mta-hourly.mjs';

describe('official MTA hourly crossing aggregates', () => {
  it('combines payment rows without collapsing source direction labels', () => {
    const result = normalizeHourlyCrossingAggregates([
      { date: '2026-09-08T00:00:00.000', facility_id: '30', facility: 'Verrazzano - Narrows Bridge', direction: 'Westbound to Staten Island', payment_method: 'E-ZPass', traffic_count: '100' },
      { date: '2026-09-08T00:00:00.000', facility_id: '30', facility: 'Verrazzano - Narrows Bridge', direction: 'Westbound to Staten Island', payment_method: 'Tolls by Mail', traffic_count: '20' },
    ]);
    expect(result.records).toEqual([expect.objectContaining({
      observed_on: '2026-09-08', plaza_id: 30, facility_name: 'Verrazzano - Narrows Bridge',
      direction: 'Westbound to Staten Island', ezpass_vehicles: 100,
      tolls_by_mail_vehicles: 20, total_vehicles: 120, ezpass_share_pct: 83.333333,
    })]);
    expect(result.quality.incomplete_payment_groups).toBe(0);
  });

  it('retains a missing payment category as null, never zero', () => {
    const result = normalizeHourlyCrossingAggregates([
      { date: '2026-07-25T00:00:00.000', facility_id: '28', facility: 'Hugh L. Carey Tunnel', direction: 'Southbound to Brooklyn', payment_method: 'E-ZPass', traffic_count: '1' },
    ]);
    expect(result.records[0].tolls_by_mail_vehicles).toBeNull();
    expect(result.records[0].total_vehicles).toBe(1);
    expect(result.records[0].ezpass_share_pct).toBeNull();
    expect(result.quality.incomplete_payment_groups).toBe(1);
  });

  it('rejects duplicate payment aggregates and unknown payment methods', () => {
    const row = { date: '2026-09-08T00:00:00.000', facility_id: '30', facility: 'Verrazzano - Narrows Bridge', direction: 'Westbound to Staten Island', payment_method: 'E-ZPass', traffic_count: '100' };
    expect(() => normalizeHourlyCrossingAggregates([row, row])).toThrow(/duplicate payment aggregate/);
    expect(() => normalizeHourlyCrossingAggregates([{ ...row, payment_method: 'Cash' }])).toThrow(/payment_method/);
  });
});
