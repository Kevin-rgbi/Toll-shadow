import type { EquitySignal } from '../../lib/analysis'

interface EquityPanelProps {
  signals: EquitySignal[]
}

const format = (value: number): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}`
}

export function EquityPanel({ signals }: EquityPanelProps) {
  const topSignals = signals.slice(0, 4)

  return (
    <aside className="analysis-card equity-card" aria-live="polite">
      <p className="analysis-kicker">EQUITY OVERLAY</p>
      <h3>Where vulnerability and worsening movement overlap</h3>
      <ul className="equity-list">
        {topSignals.map((signal) => (
          <li key={signal.borough}>
            <span>{signal.borough}</span>
            <span className={signal.netBurden > 0 ? 'net-value net-worsened' : signal.netBurden < 0 ? 'net-value net-improved' : 'net-value net-neutral'}>
              NET {format(signal.netBurden)}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  )
}
