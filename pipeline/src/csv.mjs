import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

export class CsvContractError extends Error {
  constructor(message, rowNumber = undefined) {
    super(rowNumber === undefined ? message : `row ${rowNumber}: ${message}`);
    this.name = 'CsvContractError';
    this.rowNumber = rowNumber;
  }
}

export function parseCsvLine(line, rowNumber) {
  const values = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      values.push(value);
      value = '';
    } else {
      value += character;
    }
  }

  if (quoted) throw new CsvContractError('unterminated quoted value', rowNumber);
  values.push(value);
  return values;
}

export function assertRequiredHeaders(headers, requiredHeaders) {
  const missing = requiredHeaders.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    throw new CsvContractError(`missing required columns: ${missing.join(', ')}`, 1);
  }
}

export async function* readContractCsv(filePath, requiredHeaders) {
  const stream = createReadStream(filePath, { encoding: 'utf8' });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  let headers;
  let rowNumber = 0;

  for await (const line of lines) {
    rowNumber += 1;
    if (rowNumber === 1) {
      headers = parseCsvLine(line.replace(/^\uFEFF/, ''), rowNumber);
      assertRequiredHeaders(headers, requiredHeaders);
      continue;
    }
    if (line.length === 0) continue;
    const values = parseCsvLine(line, rowNumber);
    if (values.length !== headers.length) {
      throw new CsvContractError(`expected ${headers.length} columns but found ${values.length}`, rowNumber);
    }
    yield Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  }

  if (rowNumber === 0) throw new CsvContractError('empty CSV file');
}
