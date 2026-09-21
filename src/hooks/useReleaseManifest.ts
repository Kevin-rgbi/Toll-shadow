import { useEffect, useState } from 'react'
import { loadReleaseManifest } from '../lib/releaseManifest'
import type { ReleaseManifest } from '../lib/releaseManifest'
import { DEV_SYNTHETIC_ENABLED, loadDevSyntheticDataset } from '../lib/devSyntheticDataset'
import type { DevSyntheticDataset } from '../lib/devSyntheticDataset'

/**
 * Loads the published release manifest and reports the app's data state honestly.
 *
 * - `empty` means the release pointer exists and explicitly declares that no validated release is
 *   published yet. It is not an error and it must not be rendered as data.
 * - `error` means the manifest was unreachable, malformed, or synthetic. No fallback content is
 *   substituted; the UI is expected to say what failed.
 * - `devSynthetic` is populated only when the development flag is enabled, and it is not release
 *   evidence: every view that uses it must label it as synthetic development material.
 */
export interface ReleaseManifestState {
  status: 'loading' | 'ready' | 'empty' | 'error'
  release: ReleaseManifest | null
  reason: string | null
  devSynthetic: DevSyntheticDataset | null
  isDevSynthetic: boolean
}

const initialState: ReleaseManifestState = {
  status: 'loading',
  release: null,
  reason: null,
  devSynthetic: null,
  isDevSynthetic: false,
}

export function useReleaseManifest(manifestPath = '/data/manifest.json'): ReleaseManifestState {
  const [state, setState] = useState<ReleaseManifestState>(initialState)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const result = await loadReleaseManifest(manifestPath)
        if (cancelled) return

        const devSynthetic = result.status === 'empty' && DEV_SYNTHETIC_ENABLED ? await loadDevSyntheticDataset() : null
        if (cancelled) return

        if (result.status === 'empty') {
          setState({ status: 'empty', release: null, reason: result.reason, devSynthetic, isDevSynthetic: devSynthetic !== null })
          return
        }

        setState({ status: 'ready', release: result.manifest, reason: null, devSynthetic, isDevSynthetic: devSynthetic !== null })
      } catch (error) {
        if (cancelled) return
        setState({
          status: 'error',
          release: null,
          reason: error instanceof Error ? error.message : 'Unknown release manifest error.',
          devSynthetic: null,
          isDevSynthetic: false,
        })
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [manifestPath])

  return state
}
