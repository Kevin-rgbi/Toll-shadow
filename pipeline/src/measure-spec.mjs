import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';

const DESCRIPTIVE_ONLY = 'descriptive_only';
const REQUIRED_MEASURE_FIELDS = [
  'measure_id', 'asset_kind', 'source_ids', 'coverage', 'grain', 'numerator', 'denominator', 'aggregation', 'limitations', 'claim_policy',
];

/**
 * Supported specification formats. 1.1.0 adds optional `dimensions` (reporting dimensions a
 * measure may be grouped by) and `derived_fields` in the contract. Unknown versions are rejected
 * rather than tolerated, so a spec written for a future format cannot be built by this pipeline.
 */
const SUPPORTED_SPEC_VERSIONS = new Set(['1.0.0', '1.1.0']);

export class MeasureSpecError extends Error {
  constructor(message) {
    super(`measure specification: ${message}`);
    this.name = 'MeasureSpecError';
  }
}

export function validateMeasureSpecification(specification) {
  if (!specification || !SUPPORTED_SPEC_VERSIONS.has(specification.schema_version) || !Array.isArray(specification.measures)) {
    throw new MeasureSpecError(
      `must declare a supported schema_version (${[...SUPPORTED_SPEC_VERSIONS].join(', ')}) and a measures array`,
    );
  }
  if (!specification.policy_reference || typeof specification.policy_reference.date !== 'string') {
    throw new MeasureSpecError('must declare a string policy_reference.date');
  }
  const measureIds = new Set();
  for (const measure of specification.measures) {
    for (const field of REQUIRED_MEASURE_FIELDS) {
      if (measure[field] === undefined || measure[field] === null || measure[field] === '') {
        throw new MeasureSpecError(`${measure.measure_id ?? '<unknown>'}: ${field} is required`);
      }
    }
    if (measureIds.has(measure.measure_id)) throw new MeasureSpecError(`${measure.measure_id}: duplicate measure_id`);
    measureIds.add(measure.measure_id);
    if (measure.claim_policy !== DESCRIPTIVE_ONLY) {
      throw new MeasureSpecError(`${measure.measure_id}: only descriptive_only measures are allowed in Release 1`);
    }
    if (!Array.isArray(measure.source_ids) || measure.source_ids.length === 0) {
      throw new MeasureSpecError(`${measure.measure_id}: source_ids must be a non-empty array`);
    }
    if (!Array.isArray(measure.limitations) || measure.limitations.length === 0) {
      throw new MeasureSpecError(`${measure.measure_id}: limitations must be a non-empty array`);
    }
    if (!measure.coverage || typeof measure.coverage.start !== 'string' || typeof measure.coverage.end !== 'string') {
      throw new MeasureSpecError(`${measure.measure_id}: coverage.start/end must be strings`);
    }
  }
  return specification;
}

export async function loadMeasureSpecification(filePath) {
  return validateMeasureSpecification(parse(await readFile(filePath, 'utf8')));
}
