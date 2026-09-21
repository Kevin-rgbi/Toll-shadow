import { useEffect, useMemo, useRef } from 'react'
import { AssetProvenance } from '../../components/Detail/AssetProvenance'
import { getReleaseAssets } from '../../lib/releaseManifest'
import type { ReleaseManifest } from '../../lib/releaseManifest'
import type { ReleaseAssetState } from '../../hooks/useReleaseAsset'
import type { AirContextSurface, HealthContext } from '../../types/releaseData'

interface AirContextModuleProps {
  airState: ReleaseAssetState<AirContextSurface>
  healthState: ReleaseAssetState<HealthContext>
  release: ReleaseManifest | null
}

const CANVAS_WIDTH = 320
const CANVAS_HEIGHT = 300
const TOP_HEALTH_ROWS = 8

const formatRate = (value: number | null): string => (value === null ? 'Not published' : value.toFixed(1))

/**
 * Historical air and health context (PRD FR-06).
 *
 * The air layer is a modelled annual surface published as a relative field, so it is drawn as a
 * shaded grid with no legend in concentration units and no numeric scale. The pollutant and period
 * labels come from the source filename and are shown as inferred. Health records are historical
 * county (borough) rates, labelled with their rolling periods.
 */
export function AirContextModule({ airState, healthState, release }: AirContextModuleProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const air = airState.status === 'ready' ? airState.data : null
  const health = healthState.status === 'ready' ? healthState.data : null

  const healthRows = useMemo(() => {
    if (!health) return []
    return [...health.records]
      .sort((left, right) => (right.ageAdjustedRatePer10000 ?? -1) - (left.ageAdjustedRatePer10000 ?? -1))
      .slice(0, TOP_HEALTH_ROWS)
  }, [health])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !air) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = CANVAS_WIDTH * dpr
    canvas.height = CANVAS_HEIGHT * dpr
    canvas.style.width = `${CANVAS_WIDTH}px`
    canvas.style.height = `${CANVAS_HEIGHT}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    const cellWidth = CANVAS_WIDTH / air.width
    const cellHeight = CANVAS_HEIGHT / air.height

    for (let y = 0; y < air.height; y += 1) {
      for (let x = 0; x < air.width; x += 1) {
        const value = air.grid[y]?.[x]
        if (value === null || value === undefined) continue
        // One accent ramp: the published field is relative, so alpha carries the value and no
        // numeric legend is implied.
        ctx.fillStyle = `rgba(31, 75, 216, ${(0.12 + value * 0.78).toFixed(3)})`
        ctx.fillRect(x * cellWidth, y * cellHeight, Math.ceil(cellWidth), Math.ceil(cellHeight))
      }
    }
  }, [air])

  const airAsset = release ? getReleaseAssets(release, 'historical_context')[0] ?? null : null
  const healthAsset = release ? getReleaseAssets(release, 'health_context')[0] ?? null : null

  return (
    <aside className="analysis-card module-card" aria-live="polite">
      <p className="analysis-kicker">HISTORICAL AIR AND HEALTH CONTEXT</p>
      <h3>Modelled past conditions, not a current measurement</h3>

      {(airState.status === 'loading' || airState.status === 'idle') && (
        <p className="sources-note">Reading the published air surface…</p>
      )}
      {airState.status === 'error' && <p className="sources-note sources-note-alert">{airState.reason}</p>}
      {airState.status === 'unavailable' && (
        <p className="sources-note">This release does not publish an air surface, so there is nothing to show.</p>
      )}

      {air && (
        <section className="module-section">
          <h4>Modelled annual surface, relative field</h4>
          <canvas
            ref={canvasRef}
            className="air-surface-canvas"
            role="img"
            aria-label={`Modelled annual surface drawn as a relative shaded grid of ${air.width} by ${air.height} cells. Higher shading means higher modelled values within this surface; no concentration is shown because the archive records no units.`}
          />
          <ul className="module-rows">
            <li>
              <span className="module-row-main">{air.pollutantLabel}</span>
              <span className="module-row-meta">
                {air.periodLabel} · {air.aggregation}
              </span>
            </li>
          </ul>
          <p className="sources-note">
            {air.valuesNote}. The shading shows where the modelled surface was higher within itself,
            and the panel deliberately shows no concentration, because the archive carries no unit
            codebook for this family.
          </p>
          {airAsset && <AssetProvenance asset={airAsset} measureId="nyccas_air_context_relative" />}
        </section>
      )}

      {(healthState.status === 'loading' || healthState.status === 'idle') && (
        <p className="sources-note">Reading the published health context…</p>
      )}
      {healthState.status === 'error' && <p className="sources-note sources-note-alert">{healthState.reason}</p>}
      {healthState.status === 'unavailable' && (
        <p className="sources-note">This release does not publish historical health context.</p>
      )}

      {health && (
        <section className="module-section">
          <h4>Historical health context by borough</h4>
          <ul className="module-rows">
            {healthRows.map((record) => (
              <li key={`${record.indicator}:${record.borough}:${record.period}`}>
                <span className="module-row-main">
                  {record.indicator} · {record.borough} · {record.period}
                </span>
                <span className="module-row-meta">
                  {formatRate(record.ageAdjustedRatePer10000)} per 10,000 age-adjusted
                  {record.events === null ? '' : ` · ${record.events.toLocaleString('en-US')} events`}
                </span>
              </li>
            ))}
          </ul>
          <p className="sources-note">
            {health.periodLabel}. Geography is the {health.geographyLabel}, so this is county-level
            historical context ending 2019 and not a neighbourhood or post-policy outcome. Rates are
            published exactly as the source supplied them.
          </p>
          {healthAsset && <AssetProvenance asset={healthAsset} measureId="nys_asthma_historical_context" />}
        </section>
      )}
    </aside>
  )
}
