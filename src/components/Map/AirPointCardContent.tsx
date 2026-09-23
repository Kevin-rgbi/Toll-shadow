import { AIR_UNITS } from '../../features/air/airData'

export interface AirPointCardData {
  name: string | null
  borough: string | null
  period: string | null
  pm25: number | null
  coverage: string | null
  coverageStatus: string | null
  aboveScale: boolean
  latestAvailablePm25: number | null
  latestAvailablePeriod: string | null
  latestAvailableCoverage: string | null
}

export function AirPointCardContent({ point }: { point: AirPointCardData }) {
  return (
    <>
      <p className="map-selection-kicker">PM2.5 · {point.coverageStatus === 'qualifying' ? 'QUALIFYING' : 'GAP VISIBLE'}</p>
      <h3>{point.name ?? 'Monitor'}</h3>
      <p>
        {point.borough ?? 'Borough unavailable'} · {point.period ?? 'Period unavailable'}<br />
        {point.pm25 === null ? 'No data' : `${point.pm25.toFixed(2)} ${AIR_UNITS}${point.aboveScale ? ' · above scale' : ''}`} · {point.coverage ?? 'Coverage unavailable'}
        {point.pm25 === null && point.latestAvailablePm25 !== null && (
          <><br />Latest qualifying reading: {point.latestAvailablePm25.toFixed(2)} {AIR_UNITS} · {point.latestAvailablePeriod} · {point.latestAvailableCoverage}</>
        )}
      </p>
      <p className="sources-note">Preliminary sensor data; gaps are not zero.</p>
    </>
  )
}
