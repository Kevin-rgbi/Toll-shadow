import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CsvContractError } from '../src/csv.mjs';
import { parseMtaDailyCrossings } from '../src/mta.mjs';

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
