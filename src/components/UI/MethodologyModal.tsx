import { useEffect, useRef } from 'react'
import type { ReleaseManifestState } from '../../hooks/useReleaseManifest'
import { CLAIM_GUARDRAIL, MANIFEST_PUBLIC_PATH, RELEASE_ASSET_LABELS } from '../../lib/sourceMessaging'

interface MethodologyModalProps {
  state: ReleaseManifestState
  onClose: () => void
}

export function MethodologyModal({ state, onClose }: MethodologyModalProps) {
  const dialogRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const { release, status, reason } = state

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
        <p className="chapter-label">METHODS AND LIMITS</p>
        <h2 id="methodology-title">What this product measures, and what it does not</h2>
        <p>
          Toll Shadow reports observed measurements published in a versioned data release. Each
          published asset keeps its own source register, coverage window, grain, checksum, and
          stated limitations, and the interface shows them next to the measure they describe.
        </p>

        <h3>What the product does not claim</h3>
        <ul>
          <li>It does not publish an expected or counterfactual traffic baseline.</li>
          <li>It does not treat historical air or health context as a current local outcome; preliminary NYCCAS monitor values are labeled observed concentrations and are not causal estimates.</li>
          <li>It does not use approximate CRZ entry coordinates as detector geometry.</li>
          <li>Where no approved measurement exists, the module states that it is not available.</li>
        </ul>

        <h3>Release status</h3>
        {status === 'loading' && <p>Reading {MANIFEST_PUBLIC_PATH}.</p>}
        {status === 'error' && <p>Release manifest could not be read: {reason}</p>}
        {status === 'empty' && <p>No validated data release is published yet.</p>}
        {release && (
          <>
            <p>
              Release {release.release_id} (contract {release.schema_version}) covers
              {' '}{release.coverage.start} to {release.coverage.end}, built by {release.transform_version}.
            </p>
            <ul>
              {release.assets.map((asset) => (
                <li key={asset.path}>
                  {RELEASE_ASSET_LABELS[asset.kind]}, {asset.grain} ({asset.coverage.start} to {asset.coverage.end})
                </li>
              ))}
            </ul>
            <h4>Stated limitations</h4>
            <ul>
              {release.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </>
        )}

        <p className="methodology-caution">{CLAIM_GUARDRAIL}</p>
      </section>
    </div>
  )
}
