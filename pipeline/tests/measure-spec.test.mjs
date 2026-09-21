import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MeasureSpecError, loadMeasureSpecification, validateMeasureSpecification } from '../src/measure-spec.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('Release 1 measure specification', () => {
  it('allows only source-specific descriptive measures with coverage and limitations', async () => {
    const specification = await loadMeasureSpecification(path.join(repositoryRoot, 'pipeline/methods/release-1.yaml'));
    expect(specification.measures.map((measure) => measure.asset_kind)).toEqual([
    'traffic_observations', 'facility_crossings', 'crz_context',
    'historical_context', 'health_context', 'dac_context',
  ]);
  });

  it('rejects a non-descriptive measure before a release can be built', () => {
    expect(() => validateMeasureSpecification({
      schema_version: '1.0.0',
      policy_reference: { date: '2025-01-05' },
      measures: [{
        measure_id: 'unsupported', asset_kind: 'traffic_observations', source_ids: ['source'], coverage: { start: '2025-01-01', end: '2025-01-02' }, grain: 'row', numerator: 'count', denominator: 'count', aggregation: 'none', limitations: ['test'], claim_policy: 'causal',
      }],
    })).toThrow(MeasureSpecError);
  });
});
