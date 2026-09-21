import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '../..');
const dataRoot = path.join(repositoryRoot, 'data');
const catalogPath = path.join(dataRoot, 'catalog', 'sources.yaml');
const SHA256 = /^[a-f0-9]{64}$/;
const APPROVAL_STATUSES = new Set([
  'approved_for_pipeline',
  'reference_only_pending_reproduction',
  'needs_owner_release_decision',
  'context_only_not_release_1',
]);

async function sha256(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

function fail(message) {
  throw new Error(`source catalog: ${message}`);
}

function requiredText(entry, field) {
  if (typeof entry[field] !== 'string' || entry[field].trim() === '') {
    fail(`${entry.source_id ?? '<unknown>'}: ${field} is required`);
  }
}

export async function validateSourceCatalog({ catalogFile = catalogPath, root = dataRoot, requireInputs = false } = {}) {
  const text = await BunOrNodeReadFile(catalogFile);
  const catalog = parse(text);
  if (!catalog || catalog.schema_version !== '1.0.0' || !Array.isArray(catalog.sources)) {
    fail('must contain schema_version 1.0.0 and a sources array');
  }
  const sourceIds = new Set();
  for (const entry of catalog.sources) {
    for (const field of ['source_id', 'original_path', 'approval_status', 'authoritative_url']) requiredText(entry, field);
    if (sourceIds.has(entry.source_id)) fail(`${entry.source_id}: duplicate source_id`);
    sourceIds.add(entry.source_id);
    if (!APPROVAL_STATUSES.has(entry.approval_status)) fail(`${entry.source_id}: unsupported approval_status`);
    if (!entry.temporal_coverage || typeof entry.temporal_coverage.start !== 'string' || typeof entry.temporal_coverage.end !== 'string') {
      fail(`${entry.source_id}: temporal_coverage.start/end must be strings`);
    }
    if (!Array.isArray(entry.allowed_uses) || entry.allowed_uses.length === 0 || !Array.isArray(entry.forbidden_claims) || entry.forbidden_claims.length === 0) {
      fail(`${entry.source_id}: allowed_uses and forbidden_claims must be non-empty arrays`);
    }
    const inputPath = path.resolve(root, entry.original_path);
    if (!inputPath.startsWith(`${path.resolve(root)}${path.sep}`)) fail(`${entry.source_id}: original_path escapes data root`);
    let details;
    try {
      details = await stat(inputPath);
    } catch (error) {
      if (requireInputs) fail(`${entry.source_id}: input does not exist at ${inputPath}`);
      continue;
    }
    if (details.isDirectory()) {
      if (entry.approval_status === 'approved_for_pipeline') fail(`${entry.source_id}: directory source needs a file inventory before approval`);
      continue;
    }
    if (!SHA256.test(entry.sha256 ?? '')) fail(`${entry.source_id}: sha256 must be lowercase 64-character hex`);
    const actualHash = await sha256(inputPath);
    if (actualHash !== entry.sha256) fail(`${entry.source_id}: checksum mismatch`);
  }
  return { sourceCount: catalog.sources.length, catalogFile };
}

async function BunOrNodeReadFile(filePath) {
  const { readFile } = await import('node:fs/promises');
  return readFile(filePath, 'utf8');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  validateSourceCatalog()
    .then(({ sourceCount, catalogFile: file }) => console.log(`validated ${sourceCount} sources: ${file}`))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
