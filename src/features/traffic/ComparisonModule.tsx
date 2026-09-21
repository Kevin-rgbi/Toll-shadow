import { useState } from 'react'
import type { ReleaseAssetState } from '../../hooks/useReleaseAsset'
import type { ReleaseManifest } from '../../lib/releaseManifest'
import { AssetProvenance } from '../../components/Detail/AssetProvenance'
import { changeColor, compareLocations, dailyMeasure, networkMetric, OBSERVATIONAL_LIMITATION, rankLocations } from './monthlyComparison'
import type { ComparisonSelection, LocationMetric, MonthlyAsset, MonthlyRow, Period, Ranking, TrafficLayer } from './monthlyComparison'

interface Props {
  mode: 'TRAFFIC' | 'CROSSINGS' | 'HOTSPOTS'
  selection: ComparisonSelection
  onChange: (selection: ComparisonSelection) => void
  locations: LocationMetric[]
  selectedId: string | null
  onSelect: (id: string) => void
  crz: ReleaseAssetState<MonthlyAsset>
  mta: ReleaseAssetState<MonthlyAsset>
  release: ReleaseManifest | null
}
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const layers: Record<TrafficLayer, string> = { boundary: 'Official CRZ boundary', crz: 'CRZ entries', mta: 'MTA bridges & tunnels', dot: 'Historical sampled DOT' }
const format = (value: number | null) => value === null ? 'Not available' : value.toLocaleString('en-US', { maximumFractionDigits: 1 })
const percent = (value: number | null) => value === null ? 'Not comparable' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`

function Trends({ rows, selection, selectedId }: { rows: MonthlyRow[], selection: ComparisonSelection, selectedId: string | null }) {
  const source = selectedId ? rows.filter(row => row.id === selectedId) : rows
  const points = selection.months.map(month => {
    const state = { ...selection, months: [month] }
    return { month, ...networkMetric(compareLocations(source, state), 'mta', state) }
  })
  const maximum = Math.max(1, ...points.flatMap(point => [point.baseline ?? 0, point.comparison ?? 0]))
  return <section aria-label="Monthly crossings trends">
    <h4>Monthly trends · average daily crossings</h4>
    <p className="sources-note">{selectedId ? source[0]?.name : 'All selected MTA facilities'} · complete matched months only</p>
    <div className="monthly-trends">
      {points.map(point => <div key={point.month} className="monthly-trend-row">
        <strong>{months[point.month - 1]}</strong>
        <div>{(['baseline', 'comparison'] as const).map((key, index) => <div key={key} className="monthly-trend-value">
          <span>{selection[key]}</span>
          <meter min={0} max={maximum} value={point[key] ?? 0} className={index ? 'comparison-meter' : ''} aria-label={`${months[point.month - 1]} ${selection[key]} average daily crossings`} />
          <span>{format(point[key])}</span>
        </div>)}</div>
      </div>)}
    </div>
  </section>
}

export function ComparisonModule({ mode, selection, onChange, locations, selectedId, onSelect, crz, mta, release }: Props) {
  const [ranking, setRanking] = useState<Ranking>('volume')
  const visible = mode === 'CROSSINGS' ? locations.filter(item => item.layer === 'mta') : locations
  const selected = visible.find(item => item.id === selectedId) ?? null
  const ranked = rankLocations(visible, ranking)
  const update = (patch: Partial<ComparisonSelection>) => onChange({ ...selection, ...patch })
  const totals = [
    { label: 'CRZ entries / day', layer: 'crz' as const, field: 'total' as const },
    { label: 'Excluded-roadway entries / day', layer: 'crz' as const, field: 'excluded' as const },
    { label: 'All detection entries / day', layer: 'crz' as const, field: 'all' as const },
    { label: 'MTA crossings / day', layer: 'mta' as const, field: 'total' as const },
  ].filter(item => selection.layers.includes(item.layer) && (mode !== 'CROSSINGS' || item.layer === 'mta'))
  const vehicleRows = visible.filter(item => !selected || item.id === selected.id).flatMap(item => item.rows.filter(row => row.year === selection.comparison && item.matchedMonths.includes(row.month)))
  const vehicles = vehicleRows.reduce<Record<string, number>>((result, row) => {
    Object.entries(row.vehicles).forEach(([key, value]) => { result[key] = (result[key] ?? 0) + value })
    return result
  }, {})
  const vehicleTotal = Object.values(vehicles).reduce((sum, n) => sum + n, 0)

  return <aside className="analysis-card module-card monthly-module" aria-label={`${mode} monthly comparison`}>
    <p className="analysis-kicker">{mode}</p>
    <h3>{mode === 'TRAFFIC' ? 'Traffic · 2025 vs 2026' : mode === 'CROSSINGS' ? 'MTA bridges & tunnels' : 'Observed traffic hotspots'}</h3>
    <p className="sources-note">2025 after launch is the baseline, not a pre-policy counterfactual. Default: matched February–August, excluding January.</p>
    <div className="module-filter-row">
      {(['baseline', 'comparison'] as const).map(key => <label key={key}><span>{key === 'baseline' ? 'Baseline year' : 'Comparison year'}</span><select value={selection[key]} onChange={event => update({ [key]: Number(event.target.value) })}>{[2025, 2026].map(year => <option key={year}>{year}</option>)}</select></label>)}
      <label><span>CRZ time period</span><select value={selection.period} onChange={event => update({ period: event.target.value as Period })}>{['All day', 'Peak', 'Overnight'].map(period => <option key={period}>{period}</option>)}</select></label>
    </div>
    <fieldset className="monthly-options"><legend>Matched months</legend>
      {months.map((month, index) => <label key={month}><input type="checkbox" checked={selection.months.includes(index + 1)} disabled={selection.months.length === 1 && selection.months[0] === index + 1} onChange={event => update({ months: (event.target.checked ? [...selection.months, index + 1] : selection.months.filter(value => value !== index + 1)).sort((a, b) => a - b) })} />{month}</label>)}
      <button type="button" onClick={() => update({ baseline: 2025, comparison: 2026, months: [2, 3, 4, 5, 6, 7, 8] })}>Reset to February–August 2025 vs 2026</button>
    </fieldset>
    <fieldset className="monthly-options"><legend>Traffic layers</legend>{(Object.keys(layers) as TrafficLayer[]).map(layer => <label key={layer}><input type="checkbox" checked={selection.layers.includes(layer)} onChange={event => update({ layers: event.target.checked ? [...selection.layers, layer] : selection.layers.filter(value => value !== layer) })} />{layers[layer]}</label>)}</fieldset>
    <label className="monthly-search"><span>Search facility, detection group or region</span><input type="search" value={selection.search} maxLength={200} onChange={event => update({ search: event.target.value })} /></label>
    <p className="sources-note">MTA crossings remain all-day/all-directions; their CSV does not supply Peak/Overnight counts. CRZ entries and MTA crossings are separate measures, never added together.</p>
    {[{ name: 'CRZ', state: crz }, { name: 'MTA', state: mta }].map(({ name, state }) => <p key={name} className="sources-note" role={state.status === 'error' ? 'alert' : undefined}>
      {name}: {state.status === 'ready' ? `latest ${state.data.latest.month} · ${state.data.latest.coverage_days.join('/')} observed days per row · ${state.data.latest.complete ? 'complete' : 'partial month; excluded from matched changes'}` : state.status === 'error' ? state.reason : state.status === 'loading' ? 'Loading published asset…' : 'No published asset'}
    </p>)}
    <section aria-label="Weighted daily metrics" className="monthly-metrics">
      {totals.map(item => {
        const metric = networkMetric(visible, item.layer, selection, item.field)
        return <div key={item.label}><h4>{item.label}</h4><p>{selection.baseline}: <strong>{format(metric.baseline)}</strong> → {selection.comparison}: <strong>{format(metric.comparison)}</strong></p><strong style={{ color: changeColor(metric.change) }}>{percent(metric.change)}</strong><p className="sources-note">{metric.locations} locations · shared complete months: {metric.months.map(month => months[month - 1]).join(', ') || 'none'}</p></div>
      })}
    </section>
    <p className="sources-note">Daily averages = loaded totals ÷ observed days, weighted across matched complete months. Peak + Overnight share one group-month denominator. Network summaries use months complete at every selected location; missing data is not zero.</p>
    <div className="monthly-legend" aria-label="Percent-change color bins">{[['#1f4bd8', 'Below −5%'], ['#85898f', '−5% to +5% / unavailable'], ['#df7b22', 'Above +5% to +10%'], ['#bf3038', 'Above +10%']].map(([color, label]) => <span key={label}><i style={{ background: color }} />{label}</span>)}</div>
    <label className="monthly-search"><span>{mode === 'HOTSPOTS' ? 'Hotspot ranking' : 'Facility ranking'}</span><select value={ranking} onChange={event => setRanking(event.target.value as Ranking)}><option value="increase">Largest increases (%)</option><option value="decrease">Largest decreases (%)</option><option value="volume">Highest daily volume</option><option value="coverage">Most complete matched coverage</option></select></label>
    <ol className="monthly-ranking">{ranked.map(item => <li key={item.id}><button type="button" aria-pressed={item.id === selectedId} onClick={() => onSelect(item.id)}><span>{item.name} <small>{item.layer.toUpperCase()}</small></span><strong style={{ color: changeColor(item.change) }}>{ranking === 'coverage' ? `${format(item.coverage)}% coverage` : ranking === 'volume' ? format(item.comparison) : percent(item.change)}</strong></button></li>)}</ol>
    {!ranked.length && <p className="sources-note">No locations match this ranking and selection.</p>}
    <p className="sources-note">Select a location to highlight and zoom on the map. Coverage means the share of selected months complete in both years, not statistical confidence.</p>
    {mode === 'CROSSINGS' && mta.status === 'ready' && <>
      <Trends rows={mta.data.rows} selection={selection} selectedId={selected?.id ?? null} />
      <section aria-label="Vehicle breakdown"><h4>Vehicle breakdown · {selection.comparison}</h4><p className="sources-note">{selected?.name ?? 'All selected MTA facilities'} · matched complete months · source totals</p>{Object.entries(vehicles).map(([name, total]) => <p key={name}>{name}: <strong>{format(total)}</strong> · {vehicleTotal ? (total / vehicleTotal * 100).toFixed(2) : '0'}%</p>)}{!vehicleTotal && <p>No vehicle counts for this selection.</p>}</section>
    </>}
    {selected && <section aria-label="Selected location details" className="monthly-details"><h4>{selected.name}</h4><p>{selection.baseline}: {format(selected.baseline)} / day ({selected.baselineDays} days) → {selection.comparison}: {format(selected.comparison)} / day ({selected.comparisonDays} days) · {percent(selected.change)}</p>
      {selected.rows.map(row => <details key={`${row.year}-${row.month}-${row.period}`}><summary>{row.year}-{String(row.month).padStart(2, '0')} · {row.period} · {row.days} days · {row.complete ? 'complete' : 'partial'} · {format(dailyMeasure([row]).daily)} / day</summary><dl>{Object.entries(row.details).map(([key, value]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{value === null ? 'Not supplied' : String(value)}</dd></div>)}</dl></details>)}
    </section>}
    <p className="sources-note">{OBSERVATIONAL_LIMITATION}</p>
    {release?.assets.filter(asset => asset.kind === 'crz_context' || asset.kind === 'facility_crossings').map(asset => <AssetProvenance key={asset.kind} asset={asset} measureId="matched_month_weighted_daily_volume" />)}
  </aside>
}
