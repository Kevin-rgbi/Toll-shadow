/**
 * CRZ entry aggregate adapter.
 *
 * The archived input is one documented SoQL aggregate of the authoritative MTA CRZ dataset (10-minute
 * interval entries by crossing and vehicle class), reduced to monthly sums per detection group. The
 * recipe that produced it is recorded in the source register, so the published numbers are
 * reproducible and never come from an undocumented table.
 */

export class CrzContractError extends Error {
  constructor(message) {
    super(`crz aggregate: ${message}`);
    this.name = 'CrzContractError';
  }
}

const MONTH_IN_TEXT = /^(\d{4})-(\d{2})/;

function fail(message) {
  throw new CrzContractError(message);
}

const requireText = (value, field, index) => {
  if (typeof value !== 'string' || value.trim() === '') fail(`row ${index}: ${field} must be a non-empty string`);
  return value.trim();
};

const requireMonth = (value, index) => {
  const text = requireText(value, 'month', index);
  const match = MONTH_IN_TEXT.exec(text);
  if (!match) fail(`row ${index}: month must start with YYYY-MM (got "${text}")`);
  const month = Number(match[2]);
  if (month < 1 || month > 12) fail(`row ${index}: month ${match[2]} is out of range`);
  return `${match[1]}-${match[2]}`;
};

const requireCount = (value, field, index) => {
  const text = typeof value === 'number' ? String(value) : requireText(value, field, index);
  if (!/^\d+$/.test(text)) fail(`row ${index}: ${field} must be a non-negative integer (got "${text}")`);
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed)) fail(`row ${index}: ${field} is outside the supported integer range`);
  return parsed;
};

export function normalizeCrzAggregateRows(payload) {
  if (!Array.isArray(payload)) fail('payload must be an array of aggregate rows');
  if (payload.length === 0) fail('payload must not be empty');

  return payload.map((row, index) => {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) fail(`row ${index}: must be an object`);
    return {
      detectionGroup: requireText(row.detection_group, 'detection_group', index),
      detectionRegion: requireText(row.detection_region, 'detection_region', index),
      month: requireMonth(row.month, index),
      crzEntries: requireCount(row.crz_entries, 'crz_entries', index),
      excludedRoadwayEntries: requireCount(row.excluded_roadway_entries, 'excluded_roadway_entries', index),
    };
  });
}
