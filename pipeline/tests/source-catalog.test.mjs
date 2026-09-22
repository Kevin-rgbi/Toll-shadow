import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { validateSourceCatalog } from '../scripts/validate-source-catalog.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const catalogFile = path.join(repositoryRoot, 'data/catalog/sources.yaml');
const dataRoot = path.join(repositoryRoot, 'data');
const pinnedIds = [
  'nyccas_ec_year1_17_20260810',
  'nyccas_nox_year1_17_20260810',
  'nyccas_pm_year1_17_20260810',
  'nyccas_o3_year1_17_20260810',
  'nyc_nta_westchester_square_2020_20260922',
];

describe('source catalog', () => {
  it('validates retained inputs and their checksums', async () => {
    await expect(validateSourceCatalog({
      catalogFile,
      root: dataRoot,
      requireInputs: false,
    })).resolves.toMatchObject({ sourceCount: 25 });

    const sources = parse(readFileSync(catalogFile, 'utf8')).sources;
    for (const sourceId of pinnedIds) {
      const source = sources.find((entry) => entry.source_id === sourceId);
      expect(source, `${sourceId} is not registered`).toBeDefined();
      expect(source.approval_status).toBe('approved_for_pipeline');
      expect(source.sha256).toMatch(/^[a-f0-9]{64}$/);

      const content = readFileSync(path.join(dataRoot, source.original_path));
      expect(createHash('sha256').update(content).digest('hex')).toBe(source.sha256);
    }
  });
});
