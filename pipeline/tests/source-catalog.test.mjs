import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateSourceCatalog } from '../scripts/validate-source-catalog.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workspaceRoot = path.resolve(repositoryRoot, '../..');

describe('source catalog', () => {
  it('validates retained inputs and their checksums', async () => {
    await expect(validateSourceCatalog({
      catalogFile: path.join(workspaceRoot, 'data/catalog/sources.yaml'),
      root: path.join(workspaceRoot, 'data'),
    })).resolves.toMatchObject({ sourceCount: 12 });
  });
});
