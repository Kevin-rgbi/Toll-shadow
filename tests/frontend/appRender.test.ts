import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from '../../src/App'
import { ModuleUnavailable } from '../../src/components/Detail/ModuleUnavailable'
import { getModuleUnavailableReason } from '../../src/lib/sourceMessaging'

/**
 * Render-time smoke checks for the release-only path.
 *
 * A static render uses each store's initial state (zustand serves `getInitialState` as the server
 * snapshot), so these assertions cover initial mount, crash safety, and copy safety only.
 * Interactive behavior, module switching, and map rendering need the A7 browser checks.
 */
describe('app render smoke check', () => {
  it('mounts the release-only shell without synthetic or counterfactual copy', () => {
    const markup = renderToStaticMarkup(createElement(App))

    expect(markup).toContain('THE TOLL SHADOW')
    expect(markup).toContain('NYC · NO RELEASE PUBLISHED')
    expect(markup).toContain('Not published')
    expect(markup).not.toMatch(/data\/demo/)
    expect(markup).not.toMatch(/expected no-toll/i)
    expect(markup).not.toMatch(/synthetic demo bundle/i)
  })

  it('renders the unavailable-module state instead of estimates', () => {
    const state = {
      status: 'empty' as const,
      release: null,
      reason: 'No validated data release is published yet.',
      devSynthetic: null,
      isDevSynthetic: false,
    }
    const markup = renderToStaticMarkup(createElement(ModuleUnavailable, {
      moduleName: 'TRAFFIC OBSERVATIONS',
      reason: getModuleUnavailableReason(state, 'TRAFFIC'),
    }))

    expect(markup).toContain('Not available for this claim')
    expect(markup).toContain('No validated data release is published yet')
    expect(markup).not.toMatch(/%/)
  })
})
