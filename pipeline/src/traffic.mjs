import { CsvContractError, readContractCsv } from './csv.mjs';

export const TRAFFIC_REQUIRED_COLUMNS = [
  'RequestID', 'Boro', 'Yr', 'M', 'D', 'HH', 'MM', 'Vol', 'SegmentID', 'WktGeom', 'street', 'fromSt', 'toSt', 'Direction',
];
const TRAFFIC_DIRECTIONS = new Set(['NB', 'SB', 'EB', 'WB', 'EW', 'NS']);
const POINT_WKT = /^POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)$/i;

/**
 * Reporting bands. These are the reader-facing slices of a day, not analysis constructs, and the
 * labels match the legacy Kepler table so the two can be compared. Every hour of the day lands in
 * exactly one band.
 */
export const TRAFFIC_TIME_BANDS = Object.freeze([
  'Overnight (22-06)',
  'AM peak (06-09)',
  'Midday (09-16)',
  'PM peak (16-19)',
  'Evening (19-22)',
]);

export function trafficTimeBand(hour) {
  if (hour >= 6 && hour < 9) return 'AM peak (06-09)';
  if (hour >= 9 && hour < 16) return 'Midday (09-16)';
  if (hour >= 16 && hour < 19) return 'PM peak (16-19)';
  if (hour >= 19 && hour < 22) return 'Evening (19-22)';
  return 'Overnight (22-06)';
}

/** Weekday or Weekend from the observation date. Saturday and Sunday are weekend. */
export function trafficDayType(observedAt) {
  const day = new Date(observedAt).getUTCDay();
  return day === 0 || day === 6 ? 'Weekend' : 'Weekday';
}

function requiredText(value, field, rowNumber) {
  const text = value.trim();
  if (!text) throw new CsvContractError(`${field} is required`, rowNumber);
  return text;
}

function optionalText(value) {
  const text = value.trim();
  return text || null;
}

function integer(value, field, rowNumber, minimum = undefined, allowThousandsSeparators = false) {
  const rawText = requiredText(value, field, rowNumber);
  const text = allowThousandsSeparators ? rawText.replaceAll(',', '') : rawText;
  if (!/^-?\d+$/.test(text)) throw new CsvContractError(`${field} must be an integer`, rowNumber);
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || (minimum !== undefined && parsed < minimum)) {
    throw new CsvContractError(`${field} must be an integer >= ${minimum}`, rowNumber);
  }
  return parsed;
}

export function normalizeTrafficRow(row, rowNumber) {
  const year = integer(row.Yr, 'Yr', rowNumber, 2000);
  const month = integer(row.M, 'M', rowNumber, 1);
  const day = integer(row.D, 'D', rowNumber, 1);
  const hour = integer(row.HH, 'HH', rowNumber, 0);
  const minute = integer(row.MM, 'MM', rowNumber, 0);
  if (month > 12 || day > 31 || hour > 23 || minute > 59) {
    throw new CsvContractError('date/time component is out of range', rowNumber);
  }
  const observedAt = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (observedAt.getUTCFullYear() !== year || observedAt.getUTCMonth() !== month - 1 || observedAt.getUTCDate() !== day) {
    throw new CsvContractError('date is not a valid calendar date', rowNumber);
  }
  const direction = requiredText(row.Direction, 'Direction', rowNumber);
  if (!TRAFFIC_DIRECTIONS.has(direction)) {
    throw new CsvContractError(`Direction must be one of ${[...TRAFFIC_DIRECTIONS].join(', ')}`, rowNumber);
  }
  const wkt = requiredText(row.WktGeom, 'WktGeom', rowNumber);
  const match = POINT_WKT.exec(wkt);
  if (!match) throw new CsvContractError('WktGeom must be POINT WKT', rowNumber);

  return {
    requestId: requiredText(row.RequestID, 'RequestID', rowNumber),
    borough: requiredText(row.Boro, 'Boro', rowNumber),
    observedAt: observedAt.toISOString(),
    dayType: trafficDayType(observedAt.toISOString()),
    timeBand: trafficTimeBand(hour),
    volume: integer(row.Vol, 'Vol', rowNumber, 0, true),
    segmentId: integer(row.SegmentID, 'SegmentID', rowNumber, 1),
    direction,
    sourceGeometry: { crs: 'EPSG:2263', x: Number(match[1]), y: Number(match[2]), wkt },
    street: optionalText(row.street),
    fromStreet: optionalText(row.fromSt),
    toStreet: optionalText(row.toSt),
  };
}

export async function* parseTrafficObservations(filePath) {
  let rowNumber = 1;
  for await (const row of readContractCsv(filePath, TRAFFIC_REQUIRED_COLUMNS)) {
    rowNumber += 1;
    yield normalizeTrafficRow(row, rowNumber);
  }
}
