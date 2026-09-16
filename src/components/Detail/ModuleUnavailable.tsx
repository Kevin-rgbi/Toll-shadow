interface ModuleUnavailableProps {
  moduleName: string
  reason: string
}

/**
 * Explicit state for an evidence module that has no approved release asset to render.
 * It replaces any synthetic or estimated placeholder content.
 */
export function ModuleUnavailable({ moduleName, reason }: ModuleUnavailableProps) {
  return (
    <aside className="analysis-card module-unavailable-card" aria-live="polite">
      <p className="analysis-kicker">{moduleName}</p>
      <h3>Not available for this claim</h3>
      <p>{reason}</p>
    </aside>
  )
}
