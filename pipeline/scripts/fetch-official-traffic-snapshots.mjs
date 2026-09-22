import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'data/source-snapshots/2026-09-21');
const endpoint = (id) => `https://data.ny.gov/resource/${id}.json`;

async function query(id, parameters) {
  const url = new URL(endpoint(id));
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status} ${await response.text()}`);
  return { url: url.toString(), rows: await response.json() };
}

async function paged(id, parameters, pageSize = 50000) {
  const rows = [];
  const urls = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await query(id, { ...parameters, '$limit': String(pageSize), '$offset': String(offset) });
    urls.push(page.url);
    rows.push(...page.rows);
    if (page.rows.length < pageSize) break;
  }
  return { rows, urls };
}

const crz = await paged('t6yz-b64h', {
  '$select': 'detection_group,detection_region,date_trunc_ym(toll_date) as month,sum(crz_entries) as crz_entries,sum(excluded_roadway_entries) as excluded_roadway_entries',
  '$group': 'detection_group,detection_region,month',
  '$order': 'detection_group,month',
});
const crossings = await paged('ebfx-2m7v', {
  '$select': 'date,facility_id,facility,direction,payment_method,sum(traffic_count) as traffic_count',
  '$where': 'date >= "2025-01-01T00:00:00.000"',
  '$group': 'date,facility_id,facility,direction,payment_method',
  '$order': 'date,facility_id,direction,payment_method',
});
const crzCount = await query('t6yz-b64h', { '$select': 'count(*) as count,min(toll_10_minute_block) as min_time,max(toll_10_minute_block) as max_time' });
const crossingCount = await query('ebfx-2m7v', { '$select': 'count(*) as count,min(transit_timestamp) as min_time,max(transit_timestamp) as max_time', '$where': 'date >= "2025-01-01T00:00:00.000"' });

await mkdir(output, { recursive: true });
async function publish(filename, value) {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(path.join(output, filename), content);
  return { filename, rows: value.length, bytes: Buffer.byteLength(content), sha256: createHash('sha256').update(content).digest('hex') };
}
const files = [
  await publish('crz_by_group_month.json', crz.rows),
  await publish('crossings_by_day_facility_direction_payment.json', crossings.rows),
];
await writeFile(path.join(output, 'retrieval.json'), `${JSON.stringify({
  retrieved_at: new Date().toISOString(),
  source_counts: { crz: crzCount.rows[0], crossings_2025_2026: crossingCount.rows[0] },
  queries: { crz: crz.urls, crossings: crossings.urls, crz_count: crzCount.url, crossings_count: crossingCount.url },
  files,
}, null, 2)}\n`);
console.log(JSON.stringify({ output, files }, null, 2));
