import { CsvContractError, readContractCsv } from './csv.mjs';

export const MTA_REQUIRED_COLUMNS = ['Date', 'Plaza ID', 'Direction', '# Vehicles - E-ZPass', '# Vehicles - VToll'];
const MTA_DIRECTIONS = new Set(['I', 'O']);
const KNOWN_PLAZA_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);

function parseCount(value, field, rowNumber) {
  const text = value.trim().replaceAll(',', '');
  if (!/^\d+$/.test(text)) throw new CsvContractError(`${field} must be a non-negative integer`, rowNumber);
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed)) throw new CsvContractError(`${field} is outside the supported integer range`, rowNumber);
  return parsed;
}

function parseDate(value, rowNumber) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) throw new CsvContractError('Date must use MM/DD/YYYY', rowNumber);
  const [, monthText, dayText, yearText] = match;
  const month = Number(monthText);
  const day = Number(dayText);
  const year = Number(yearText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new CsvContractError('Date is not a valid calendar date', rowNumber);
  }
  return date.toISOString().slice(0, 10);
}

export function normalizeMtaDailyRow(row, rowNumber) {
  const plazaId = parseCount(row['Plaza ID'], 'Plaza ID', rowNumber);
  if (!KNOWN_PLAZA_IDS.has(plazaId)) throw new CsvContractError(`unknown Plaza ID ${plazaId}`, rowNumber);
  const direction = row.Direction.trim();
  if (!MTA_DIRECTIONS.has(direction)) throw new CsvContractError('Direction must be I or O', rowNumber);
  const ezpassVehicles = parseCount(row['# Vehicles - E-ZPass'], '# Vehicles - E-ZPass', rowNumber);
  const vtollVehicles = parseCount(row['# Vehicles - VToll'], '# Vehicles - VToll', rowNumber);
  return {
    observedOn: parseDate(row.Date, rowNumber),
    plazaId,
    direction,
    ezpassVehicles,
    vtollVehicles,
    totalVehicles: ezpassVehicles + vtollVehicles,
  };
}

export async function* parseMtaDailyCrossings(filePath) {
  let rowNumber = 1;
  for await (const row of readContractCsv(filePath, MTA_REQUIRED_COLUMNS)) {
    rowNumber += 1;
    yield normalizeMtaDailyRow(row, rowNumber);
  }
}
