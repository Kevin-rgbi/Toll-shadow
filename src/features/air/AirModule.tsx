import { useEffect, useMemo, useState } from 'react'
import {
  AIR_ASSET_LABEL,
  AIR_CLAIM_GUARDRAIL,
  AIR_SCALE_LABEL,
  AIR_UNITS,
  buildAirCoverageSummary,
  buildAirMonthlyComparison,
  formatAirPeriod,
  formatAirValue,
} from './airData'
import type { AirCoverageSummary, AirDailyReading, AirGranularity, AirHourlyReading, AirLoadState } from '../../types/air'

interface AirModuleProps {
  state: AirLoadState
  granularity: AirGranularity
  onGranularityChange: (granularity: AirGranularity) => void
  timestamp: number
  selectedSiteId: string | null
  onSelectSite: (siteId: string) => void
  borough: string | null
  onBoroughChange: (borough: string | null) => void
  siteFilter: string
  onSiteFilterChange: (siteFilter: string) => void
  boundaryVisible: boolean
  onBoundaryChange: (visible: boolean) => void
  comparisonOpen: boolean
  onComparisonChange: (open: boolean) => void
  includePartial: boolean
  onIncludePartialChange: (include: boolean) => void
}

type AirReading = AirDailyReading | AirHourlyReading

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DEFAULT_COMPARE_MONTHS = [2, 3, 4, 5, 6, 7, 8]

const sampleSeries = (entries: Array<{ timestamp: number, reading: AirReading | null }>, maximum: number) => {
  if (entries.length <= maximum) return entries
  const stride = Math.ceil(entries.length / maximum)
  return entries.filter((_, index) => index % stride === 0)
}

const readingValue = (reading: AirReading | null): number | null => reading?.pm25 ?? null

function MonitorChart({
  entries,
  granularity,
  timestamp,
  onCursor,
}: {
  entries: Array<{ timestamp: number, reading: AirReading | null }>
  granularity: AirGranularity
  timestamp: number
  onCursor: (timestamp: number | null) => void
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const sampled = useMemo(() => sampleSeries(entries, 360), [entries])
  const width = 700
  const height = 220
  const padLeft = 46
  const padRight = 14
  const padTop = 16
  const padBottom = 34
  const innerWidth = width - padLeft - padRight
  const innerHeight = height - padTop - padBottom
  const xFor = (index: number) => sampled.length <= 1 ? padLeft : padLeft + (index / (sampled.length - 1)) * innerWidth
  const yFor = (value: number | null) => padTop + ((Math.min(50, Math.max(0, value ?? 0)) / 50) * innerHeight)
  const segments: number[][] = []
  let segment: number[] = []
  sampled.forEach((point, index) => {
    if (readingValue(point.reading) === null) {
      if (segment.length > 1) segments.push(segment)
      segment = []
      return
    }
    segment.push(index)
  })
  if (segment.length > 1) segments.push(segment)
  const cursorTimestamp = hovered ?? timestamp
  const cursorIndex = sampled.length > 0 ? sampled.reduce((closest, point, index) => Math.abs(point.timestamp - cursorTimestamp) < Math.abs(sampled[closest].timestamp - cursorTimestamp) ? index : closest, 0) : -1
  const cursorPoint = cursorIndex >= 0 ? sampled[cursorIndex] : null
  const cursorReading = cursorPoint ? cursorPoint.reading : null

  return (
    <section className="air-chart" aria-label={`PM2.5 chart for ${granularity} data`}>
      <div className="air-chart-head">
        <div>
          <p className="air-chart-kicker">SELECTED MONITOR · {AIR_UNITS}</p>
          <h4>{formatAirValue(readingValue(cursorReading), cursorReading !== null && cursorReading.pm25 !== null && cursorReading.pm25 > 50)}</h4>
        </div>
        <p className="sources-note">{granularity === 'daily' ? 'Daily mean · 18-hour minimum coverage' : 'Hourly record · missing hours remain missing'}</p>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="PM2.5 time series chart"
        onMouseMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect()
          const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
          const x = ratio * width
          const index = Math.round(((x - padLeft) / innerWidth) * (sampled.length - 1))
          const point = sampled[Math.max(0, Math.min(sampled.length - 1, index))]
          setHovered(point?.timestamp ?? null)
          onCursor(point?.timestamp ?? null)
        }}
        onMouseLeave={() => {
          setHovered(null)
          onCursor(null)
        }}
      >
        {[0, 10, 20, 30, 40, 50].map((value) => {
          const y = yFor(value)
          return <g key={value}>
            <line x1={padLeft} x2={width - padRight} y1={y} y2={y} className="air-chart-grid" />
            <text x={padLeft - 8} y={y + 4} className="air-chart-label" textAnchor="end">{value}</text>
          </g>
        })}
        {segments.map((segment, index) => {
          const path = segment.map((pointIndex, pointOffset) => `${pointOffset === 0 ? 'M' : 'L'} ${xFor(pointIndex).toFixed(2)} ${yFor(readingValue(sampled[pointIndex].reading)).toFixed(2)}`).join(' ')
          return <path key={index} d={path} className="air-chart-line" />
        })}
        {sampled.map((point, index) => {
          const value = readingValue(point.reading)
          if (value === null) return null
          return <circle key={point.timestamp} cx={xFor(index)} cy={yFor(value)} r={value > 50 ? 3.5 : 2.5} className={value > 50 ? 'air-chart-point air-chart-point-above' : 'air-chart-point'} />
        })}
        {cursorPoint && <line x1={xFor(Math.max(0, cursorIndex))} x2={xFor(Math.max(0, cursorIndex))} y1={padTop} y2={height - padBottom} className="air-chart-cursor" />}
        <text x={padLeft} y={height - 8} className="air-chart-label">{sampled[0] ? formatAirPeriod(sampled[0].timestamp, granularity).split(' · ')[0] : ''}</text>
        <text x={width - padRight} y={height - 8} className="air-chart-label" textAnchor="end">{sampled.at(-1) ? formatAirPeriod(sampled.at(-1)!.timestamp, granularity).split(' · ')[0] : ''}</text>
      </svg>
      {cursorPoint && (
        <p className="air-chart-tooltip" aria-live="polite">
          {formatAirPeriod(cursorPoint.timestamp, granularity)} · {formatAirValue(readingValue(cursorReading), cursorReading !== null && cursorReading.pm25 !== null && cursorReading.pm25 > 50)}
        </p>
      )}
    </section>
  )
}

function CoverageMetrics({ summary }: { summary: AirCoverageSummary | null }) {
  if (!summary) return <p className="sources-note">Coverage summary is not available.</p>
  return (
    <dl className="analysis-metrics">
      <div><dt>UTC coverage</dt><dd>{summary.daily.startDate} → {summary.daily.endDate}</dd></div>
      <div><dt>Monitors</dt><dd>{summary.daily.monitors}</dd></div>
      <div><dt>Qualifying site-days</dt><dd>{summary.daily.qualifyingSiteDays.toLocaleString('en-US')}</dd></div>
      <div><dt>No-data site-days</dt><dd>{summary.daily.noDataSiteDays.toLocaleString('en-US')}</dd></div>
      <div><dt>Under 18 hours</dt><dd>{summary.daily.insufficientHoursSiteDays.toLocaleString('en-US')}</dd></div>
      {summary.hourly && <div><dt>Hourly records</dt><dd>{summary.hourly.presentRecords.toLocaleString('en-US')} present · {summary.hourly.missingRecords.toLocaleString('en-US')} missing</dd></div>}
    </dl>
  )
}

function ComparisonTable({
  dataset,
  includePartial,
  onIncludePartialChange,
}: {
  dataset: NonNullable<AirLoadState['dataset']>
  includePartial: boolean
  onIncludePartialChange: (include: boolean) => void
}) {
  const comparison = useMemo(() => buildAirMonthlyComparison(dataset.daily, 2025, 2026, DEFAULT_COMPARE_MONTHS, includePartial), [dataset.daily, includePartial])
  const format = (value: number | null) => value === null ? 'Not comparable' : `${value.toFixed(2)} ${AIR_UNITS}`
  const change = (value: number | null) => value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
  return (
    <section className="air-comparison" aria-label="Year-over-year PM2.5 comparison">
      <div className="air-comparison-head">
        <div>
          <p className="air-chart-kicker">YEAR-OVER-YEAR AFTER LAUNCH</p>
          <h4>2025 baseline → 2026 comparison</h4>
        </div>
        <label className="air-partial-control"><input type="checkbox" checked={includePartial} onChange={(event) => onIncludePartialChange(event.target.checked)} /> Include partial months</label>
      </div>
      <p className="sources-note">Descriptive matched-month comparison only. It is not a counterfactual or evidence that congestion pricing caused a change.</p>
      <div className="air-comparison-table" role="table" aria-label="Monthly PM2.5 comparison">
        <div role="row"><span>Month</span><span>2025 mean</span><span>2026 mean</span><span>Change</span><span>2026 coverage</span></div>
        {comparison.months.map((month) => <div role="row" key={month.month}>
          <span>{MONTHS[month.month - 1]}</span>
          <span>{format(month.baselineMean)}</span>
          <span>{format(month.comparisonMean)}</span>
          <span>{change(month.comparisonMean === null || month.baselineMean === null || month.baselineMean === 0 ? null : (month.comparisonMean - month.baselineMean) / month.baselineMean * 100)}</span>
          <span>{month.comparisonCoverage.toFixed(0)}%</span>
        </div>)}
      </div>
      {comparison.partialMonths.length > 0 && <p className="sources-note">{includePartial ? 'Partial months included:' : 'Partial months excluded by default:'} {comparison.partialMonths.join(', ')}. Coverage is the share of qualifying site-days, not statistical confidence.</p>}
    </section>
  )
}

export function AirModule({
  state,
  granularity,
  onGranularityChange,
  timestamp,
  selectedSiteId,
  onSelectSite,
  borough,
  onBoroughChange,
  siteFilter,
  onSiteFilterChange,
  boundaryVisible,
  onBoundaryChange,
  comparisonOpen,
  onComparisonChange,
  includePartial,
  onIncludePartialChange,
}: AirModuleProps) {
  const dataset = state.dataset
  const [chartCursor, setChartCursor] = useState<number | null>(null)

  const stations = useMemo(() => dataset?.daily.stations ?? [], [dataset])
  const boroughs = useMemo(() => [...new Set(stations.map((station) => station.borough))].sort(), [stations])
  const siteOptions = useMemo(() => stations.filter((station) => !borough || station.borough === borough), [borough, stations])
  const selectedStation = siteOptions.find((station) => station.id === selectedSiteId) ?? siteOptions[0] ?? null
  const selectedId = selectedStation?.id ?? null

  const chartEntries = useMemo<Array<{ timestamp: number, reading: AirReading | null }>>(() => {
    if (!dataset || !selectedId) return []
    if (granularity === 'daily') {
      return dataset.daily.dates.map((date) => ({ timestamp: Date.parse(`${date}T00:00:00Z`), reading: dataset.daily.byDate.get(date)?.get(selectedId) ?? null }))
    }
    if (!dataset.hourly) return []
    return dataset.hourly.timestamps.map((step) => ({ timestamp: step, reading: dataset.hourly?.byTimestamp.get(step)?.get(selectedId) ?? null }))
  }, [dataset, granularity, selectedId])

  const currentReading = useMemo<AirReading | null>(() => {
    if (!dataset || !selectedId) return null
    if (granularity === 'daily') return dataset.daily.byDate.get(new Date(timestamp).toISOString().slice(0, 10))?.get(selectedId) ?? null
    return dataset.hourly?.byTimestamp.get(timestamp)?.get(selectedId) ?? null
  }, [dataset, granularity, selectedId, timestamp])

  const summary = useMemo(() => dataset ? buildAirCoverageSummary(dataset) : null, [dataset])
  const currentPeriod = formatAirPeriod(timestamp, granularity)

  useEffect(() => {
    if (!selectedSiteId || siteOptions.some((station) => station.id === selectedSiteId) || !siteOptions[0]) return
    onSelectSite(siteOptions[0].id)
  }, [onSelectSite, selectedSiteId, siteOptions])

  return (
    <aside className="analysis-card module-card air-module" aria-live="polite">
      <p className="analysis-kicker">AIR · OBSERVED MONITOR DATA</p>
      <h3>Measured PM2.5, with the gaps left visible</h3>
      <p className="sources-note">{AIR_ASSET_LABEL}</p>
      <p className="sources-note">{AIR_CLAIM_GUARDRAIL}</p>
      <p className="sources-note">Point measurements from the supplied NYCCAS Kepler derivatives. Values are concentrations in {AIR_UNITS}, not an AQI, modeled surface, health outcome, or causal estimate.</p>

      {state.status === 'unavailable' && <p className="sources-note sources-note-alert">AIR data unavailable: {state.reason}</p>}
      {state.status === 'loading' && <p className="sources-note">{granularity === 'hourly' && dataset?.hourly === null ? 'Loading the hourly PM2.5 CSV…' : 'Reading the daily PM2.5 CSV…'}</p>}
      {state.status === 'error' && <p className="sources-note sources-note-alert">AIR data could not be loaded: {state.reason}</p>}
      {state.status !== 'error' && dataset && (
        <>
          <div className="module-filter-row">
            <label><span>Resolution</span><select value={granularity} onChange={(event) => onGranularityChange(event.target.value as AirGranularity)}><option value="daily">Daily</option><option value="hourly">Hourly</option></select></label>
            <label><span>Borough</span><select value={borough ?? ''} onChange={(event) => onBoroughChange(event.target.value === '' ? null : event.target.value)}><option value="">All boroughs</option>{boroughs.map((option) => <option key={option}>{option}</option>)}</select></label>
            <label><span>Monitor</span><select value={selectedId ?? ''} onChange={(event) => onSelectSite(event.target.value)}>{siteOptions.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}</select></label>
            <label><span>Map shortcut</span><select value={siteFilter} onChange={(event) => onSiteFilterChange(event.target.value)}><option value="all">All monitors</option><option value="south-bronx">South Bronx</option>{siteOptions.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}</select></label>
          </div>

          <div className="air-current-row">
            <div><span className="air-chart-kicker">CURRENT STEP</span><strong>{currentPeriod}</strong></div>
            <div><span className="air-chart-kicker">SELECTED VALUE</span><strong>{formatAirValue(currentReading?.pm25 ?? null, currentReading !== null && currentReading.pm25 !== null && currentReading.pm25 > 50)}</strong></div>
            <div><span className="air-chart-kicker">COVERAGE</span><strong>{granularity === 'daily' ? `${currentReading ? (currentReading as AirDailyReading).coverageHours : 0}/24 h` : currentReading ? '1 hourly record' : 'No record'}</strong></div>
          </div>

          <MonitorChart entries={chartEntries} granularity={granularity} timestamp={chartCursor ?? timestamp} onCursor={setChartCursor} />

          <div className="air-legend" aria-label="PM2.5 color scale"><span>{AIR_SCALE_LABEL}</span><span className="air-legend-missing">Hollow gray = missing or insufficient coverage</span></div>

          <div className="air-view-toggles">
            <button type="button" className={comparisonOpen ? 'is-active' : ''} aria-pressed={comparisonOpen} onClick={() => onComparisonChange(!comparisonOpen)}>Year-over-year after launch</button>
            <label><input type="checkbox" checked={boundaryVisible} onChange={(event) => onBoundaryChange(event.target.checked)} /> Show CRZ boundary</label>
          </div>

          {comparisonOpen && <ComparisonTable dataset={dataset} includePartial={includePartial} onIncludePartialChange={onIncludePartialChange} />}

          <CoverageMetrics summary={summary} />

          {selectedStation && (
            <section className="air-monitor-detail">
              <h4>{selectedStation.name}</h4>
              <p className="sources-note">{selectedStation.borough} · {selectedStation.coordinates[1].toFixed(5)}, {selectedStation.coordinates[0].toFixed(5)}{selectedStation.locationHistoryFlag ? ' · location history differs from the supplied current coordinates' : ''}</p>
            </section>
          )}

          <section className="module-provenance">
            <h4>Source and limits</h4>
            <dl className="analysis-metrics">
              <div><dt>Daily file</dt><dd>{dataset.sourceFiles[0] ?? 'unavailable'} · {dataset.dailyBytes.toLocaleString('en-US')} bytes</dd></div>
              {dataset.hourlyBytes !== null && <div><dt>Hourly file</dt><dd>{dataset.sourceFiles[1] ?? 'unavailable'} · {dataset.hourlyBytes.toLocaleString('en-US')} bytes</dd></div>}
              <div><dt>Source register</dt><dd><a href="https://data.cityofnewyork.us/Environment/NYCCAS-Air-Pollution-Rasters/q68s-8qxv/about_data" target="_blank" rel="noreferrer">NYCCAS air-pollution raster archive · q68s-8qxv</a></dd></div>
              <div><dt>Quality</dt><dd>Preliminary; subject to revision</dd></div>
            </dl>
            <ul className="sources-list sources-list-compact">
              <li>Daily values require at least 18 valid hours; missing and low-coverage records are not coerced to zero.</li>
              <li>Hourly mode loads the larger CSV on demand and never carries a prior reading forward.</li>
              <li>Monitor coordinates are approximate supplied locations. Midtown West has a location-history caveat.</li>
              <li>These observations do not establish a congestion-pricing effect, a current regulatory exceedance, or a health outcome.</li>
            </ul>
          </section>
        </>
      )}
    </aside>
  )
}
