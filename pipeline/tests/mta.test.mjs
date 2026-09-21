import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CsvContractError } from '../src/csv.mjs';
import { buildFacilityLookup, facilityFor, parseMtaDailyCrossings } from '../src/mta.mjs';

const fixture = (name) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);

async function collect(generator) {
  const results = [];
  for await (const item of generator) results.push(item);
  return results;
}

describe('parseMtaDailyCrossings', () => {
  it('normalizes comma-formatted daily MTA counts with a documented plaza ID', async () => {
    await expect(collect(parseMtaDailyCrossings(fixture('mta-valid.csv')))).resolves.toEqual([
      { observedOn: '2025-01-05', plazaId: 21, direction: 'I', ezpassVehicles: 33976, vtollVehicles: 5194, totalVehicles: 39170 },
    ]);
  });

  it('rejects an unsupported plaza ID', async () => {
    await expect(collect(parseMtaDailyCrossings(fixture('mta-unknown-plaza.csv')))).rejects.toBeInstanceOf(CsvContractError);
  });
});

describe('facility naming from the source register', () => {
  const catalogEntry = {
    schema: {
      facility_ids: [
        { plaza_id: 21, facility_code: 'TBX', facility_name: 'Robert F. Kennedy Bridge (Bronx and Queens plazas)' },
      ],
    },
  };

  it('builds a lookup from the register', () => {
    const lookup = buildFacilityLookup(catalogEntry);
    expect(facilityFor(21, lookup, 2)).toEqual({
      code: 'TBX',
      name: 'Robert F. Kennedy Bridge (Bronx and Queens plazas)',
    });
  });

  it('refuses a plaza the register cannot name instead of publishing an identifier', () => {
    const lookup = buildFacilityLookup(catalogEntry);
    expect(() => facilityFor(27, lookup, 2)).toThrow(/no facility name in the source register/);
  });

  it('refuses a register with no facility mapping at all', () => {
    expect(() => buildFacilityLookup({ schema: {} })).toThrow(/must declare schema.facility_ids/);
  });

  it('refuses a partially specified facility entry', () => {
    expect(() => buildFacilityLookup({ schema: { facility_ids: [{ plaza_id: 21, facility_code: 'TBX' }] } }))
      .toThrow(/needs plaza_id, facility_code and facility_name/);
  });
});
