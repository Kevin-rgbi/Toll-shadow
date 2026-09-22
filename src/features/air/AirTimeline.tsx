import { formatAirPeriod } from './airData'
import type { AirGranularity } from '../../types/air'
import { AIR_PLAYBACK_RATES } from './airPlaybackRates'

interface AirTimelineProps {
  granularity: AirGranularity
  steps: number[]
  timestamp: number
  isPlaying: boolean
  playbackRate: number
  loop: boolean
  scrubbing: boolean
  onPlay: () => void
  onRestart: () => void
  onPrevious: () => void
  onNext: () => void
  onRateChange: (rate: number) => void
  onLoopChange: () => void
  onScrub: (timestamp: number) => void
  onScrubStart: () => void
  onScrubEnd: () => void
}

export function AirTimeline({
  granularity,
  steps,
  timestamp,
  isPlaying,
  playbackRate,
  loop,
  scrubbing,
  onPlay,
  onRestart,
  onPrevious,
  onNext,
  onRateChange,
  onLoopChange,
  onScrub,
  onScrubStart,
  onScrubEnd,
}: AirTimelineProps) {
  const currentIndex = Math.max(0, steps.indexOf(timestamp))
  const period = steps.length > 0 ? formatAirPeriod(timestamp, granularity) : 'No recorded step'

  return (
    <footer className="air-timeline-shell" aria-label="AIR playback timeline">
      <div className="air-playback-controls">
        <button type="button" onClick={onRestart} disabled={steps.length === 0} aria-label="Restart AIR timeline">⟲</button>
        <button type="button" onClick={onPrevious} disabled={steps.length === 0} aria-label="Previous AIR step">‹</button>
        <button type="button" className="air-play-button" onClick={onPlay} disabled={steps.length === 0} aria-label={isPlaying ? 'Pause AIR timeline' : 'Play AIR timeline'}>
          {isPlaying ? '||' : '>'}
        </button>
        <button type="button" onClick={onNext} disabled={steps.length === 0} aria-label="Next AIR step">›</button>
        <label className="air-rate-control">
          <span>Speed</span>
          <select value={playbackRate} onChange={(event) => onRateChange(Number(event.target.value))}>
            {AIR_PLAYBACK_RATES.map((rate) => <option key={rate} value={rate}>{rate}×</option>)}
          </select>
        </label>
        <label className="air-loop-control">
          <input type="checkbox" checked={loop} onChange={onLoopChange} />
          <span>Loop</span>
        </label>
      </div>
      <div className="air-timeline-track">
        <input
          type="range"
          min="0"
          max={Math.max(0, steps.length - 1)}
          value={currentIndex}
          disabled={steps.length === 0}
          aria-label="AIR timeline position"
          aria-valuetext={formatAirPeriod(timestamp, granularity)}
          onChange={(event) => {
            const nextIndex = Number(event.target.value)
            onScrub(steps[nextIndex] ?? timestamp)
          }}
          onPointerDown={onScrubStart}
          onPointerUp={onScrubEnd}
          onPointerCancel={onScrubEnd}
        />
      </div>
      <p className="air-timeline-period" aria-live="polite">{scrubbing ? 'Scrubbing · ' : ''}{period}</p>
    </footer>
  )
}
