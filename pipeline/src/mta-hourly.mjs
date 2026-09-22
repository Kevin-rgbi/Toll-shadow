const PAYMENT_METHODS = new Set(['E-ZPass', 'Tolls by Mail']);
const DATE = /^(\d{4}-\d{2}-\d{2})/;

function required(value, field, index) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`MTA aggregate row ${index}: ${field} is required`);
  return value.trim();
}

function count(value, field, index) {
  const text = required(value, field, index);
  if (!/^\d+$/.test(text)) throw new Error(`MTA aggregate row ${index}: ${field} must be a non-negative integer`);
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed)) throw new Error(`MTA aggregate row ${index}: ${field} is outside the supported range`);
  return parsed;
}

export function normalizeHourlyCrossingAggregates(rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('MTA aggregate snapshot must be a non-empty array');
  const groups = new Map();
  for (const [index, row] of rows.entries()) {
    const match = DATE.exec(required(row.date, 'date', index));
    if (!match || !Number.isFinite(Date.parse(`${match[1]}T00:00:00Z`))) throw new Error(`MTA aggregate row ${index}: invalid date`);
    const plazaId = count(row.facility_id, 'facility_id', index);
    const facilityName = required(row.facility, 'facility', index);
    const direction = required(row.direction, 'direction', index);
    const paymentMethod = required(row.payment_method, 'payment_method', index);
    if (!PAYMENT_METHODS.has(paymentMethod)) throw new Error(`MTA aggregate row ${index}: unsupported payment_method ${paymentMethod}`);
    const key = `${match[1]}|${plazaId}|${facilityName}|${direction}`;
    const group = groups.get(key) ?? { observedOn: match[1], plazaId, facilityName, direction, payments: new Map() };
    if (group.payments.has(paymentMethod)) throw new Error(`MTA aggregate row ${index}: duplicate payment aggregate for ${key}`);
    group.payments.set(paymentMethod, count(row.traffic_count, 'traffic_count', index));
    groups.set(key, group);
  }

  let incompletePaymentGroups = 0;
  const records = [...groups.values()].map((group) => {
    const ezpass = group.payments.get('E-ZPass') ?? null;
    const mail = group.payments.get('Tolls by Mail') ?? null;
    if (ezpass === null || mail === null) incompletePaymentGroups += 1;
    const total = (ezpass ?? 0) + (mail ?? 0);
    return {
      source_id: 'mta_hourly_crossings_archive_20260921',
      measure_id: 'mta_daily_facility_crossings_from_hourly',
      observed_on: group.observedOn,
      plaza_id: group.plazaId,
      facility_code: String(group.plazaId),
      facility_name: group.facilityName,
      direction: group.direction,
      ezpass_vehicles: ezpass,
      tolls_by_mail_vehicles: mail,
      total_vehicles: total,
      ezpass_share_pct: total > 0 && ezpass !== null && mail !== null ? Number(((ezpass / total) * 100).toFixed(6)) : null,
    };
  }).sort((left, right) => `${left.observed_on}|${left.plaza_id}|${left.direction}`.localeCompare(`${right.observed_on}|${right.plaza_id}|${right.direction}`));

  return {
    records,
    quality: {
      aggregate_rows: rows.length,
      published_groups: records.length,
      incomplete_payment_groups: incompletePaymentGroups,
    },
  };
}
