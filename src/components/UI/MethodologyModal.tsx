import { useEffect, useRef } from 'react'
import {
  CAUSATION_GUARDRAIL,
  CURRENT_BUILD_POINTS,
  MANIFEST_PUBLIC_PATH,
  PIPELINE_STATUS_POINTS,
  PLANNED_MTA_SOURCES,
  PLANNED_NON_MTA_SOURCES,
  SCAFFOLD_STRENGTH_LINE,
} from '../../lib/sourceMessaging'

interface MethodologyModalProps {
  onClose: () => void
}

export function MethodologyModal({ onClose }: MethodologyModalProps) {
  const dialogRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const focusTarget = closeButtonRef.current ?? dialogRef.current
    focusTarget?.focus()

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className="methodology-modal"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="methodology-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          className="modal-close"
          type="button"
          aria-label="Close methodology"
          onClick={onClose}
        >
          ×
        </button>
        <p className="chapter-label">METHODS · SCAFFOLD</p>
        <h2 id="methodology-title">Where does observed NYC diverge from a no-toll expectation?</h2>
        <p>
          {SCAFFOLD_STRENGTH_LINE}
        </p>
        <h3>Current build data contract</h3>
        <p>
          Current build values are synthetic effects, loaded through {MANIFEST_PUBLIC_PATH}.
        </p>
        <ul>
          {CURRENT_BUILD_POINTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>

        <h3>Planned source integration</h3>
        <p>
          Planned MTA and non-MTA source connections are defined and deferred
          until pipeline exports are stable and versioned.
        </p>

        <h4>Planned MTA sources</h4>
        <ul>
          {PLANNED_MTA_SOURCES.map((source) => (
            <li key={source}>{source}</li>
          ))}
        </ul>

        <h4>Planned non-MTA sources</h4>
        <ul>
          {PLANNED_NON_MTA_SOURCES.map((source) => (
            <li key={source}>{source}</li>
          ))}
        </ul>

        <h3>Pipeline status</h3>
        <ul>
          {PIPELINE_STATUS_POINTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>

        <p className="methodology-caution">
          {CAUSATION_GUARDRAIL}
        </p>
      </section>
    </div>
  )
}