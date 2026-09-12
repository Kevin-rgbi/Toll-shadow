import { useEffect, useState } from 'react'
import { loadDatasetFromManifest } from '../lib/dataManifest'
import type { ManifestDataset } from '../lib/dataManifest'

interface ManifestDatasetState {
  data: ManifestDataset | null
  isLoading: boolean
  error: string | null
}

export function useManifestDataset(manifestPath = '/data/manifest.json'): ManifestDatasetState {
  const [state, setState] = useState<ManifestDatasetState>({
    data: null,
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const data = await loadDatasetFromManifest(manifestPath)
        if (cancelled) return
        setState({ data, isLoading: false, error: null })
      } catch (error) {
        if (cancelled) return
        setState({
          data: null,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown dataset error.',
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
