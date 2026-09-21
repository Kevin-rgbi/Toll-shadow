import { useEffect, useMemo, useState } from 'react'
import {
  parseAirDailyCsv,
  parseAirHourlyCsv,
} from '../features/air/airData'
import type { AirDataset, AirGranularity, AirLoadState } from '../types/air'
import { getReleaseAssets } from '../lib/releaseManifest'
import type { ReleaseAsset, ReleaseManifest } from '../lib/releaseManifest'
import { verifySha256 } from '../lib/checksum'

type ReleaseStatus = 'loading' | 'ready' | 'empty' | 'error'

interface LoadedCsv<T> {
  path: string
  data: T
  bytes: number
}

const airAssetFor = (assets: ReleaseAsset[], granularity: 'daily' | 'hourly'): ReleaseAsset | null => {
  return assets.find((asset) => {
    if (asset.format !== 'csv') return false
    const path = asset.path.toLowerCase()
    const grain = asset.grain.toLowerCase()
    return path.includes(granularity) || grain.includes(granularity)
  }) ?? null
}

export function useAirDataset(
  enabled: boolean,
  granularity: AirGranularity,
  release?: ReleaseManifest | null,
  releaseStatus: ReleaseStatus = release ? 'ready' : 'loading',
  releaseReason: string | null = null,
): AirLoadState {
  const [daily, setDaily] = useState<LoadedCsv<ReturnType<typeof parseAirDailyCsv>> | null>(null)
  const [hourly, setHourly] = useState<LoadedCsv<ReturnType<typeof parseAirHourlyCsv>> | null>(null)
  const [reason, setReason] = useState<string | null>(null)
  const [reasonPath, setReasonPath] = useState<string | null>(null)

  const airAssets = release ? getReleaseAssets(release, 'air_measurements') : []
  const dailyAsset = airAssetFor(airAssets, 'daily')
  const hourlyAsset = airAssetFor(airAssets, 'hourly')
  const dailyLoaded = dailyAsset && daily?.path === dailyAsset.path ? daily : null
  const hourlyLoaded = hourlyAsset && hourly?.path === hourlyAsset.path ? hourly : null

  useEffect(() => {
    if (!enabled || !dailyAsset) return

    const controller = new AbortController()

    void (async () => {
      try {
        const response = await fetch(dailyAsset.path, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`${dailyAsset.path} could not be fetched (HTTP ${response.status})`)
        }

        const buffer = await response.arrayBuffer()
        await verifySha256(buffer, dailyAsset.sha256, dailyAsset.path)
        const text = new TextDecoder().decode(buffer)
        const data = parseAirDailyCsv(text, dailyAsset.path)
        if (!controller.signal.aborted) setDaily({ path: dailyAsset.path, data, bytes: buffer.byteLength })
      } catch (error) {
        if (controller.signal.aborted) return
        setReason(error instanceof Error ? error.message : String(error))
        setReasonPath(dailyAsset.path)
      }
    })()

    return () => controller.abort()
  }, [dailyAsset, dailyAsset?.path, dailyAsset?.sha256, enabled])

  useEffect(() => {
    if (!enabled || granularity !== 'hourly' || !dailyLoaded || !hourlyAsset) return

    const controller = new AbortController()

    void (async () => {
      try {
        const response = await fetch(hourlyAsset.path, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`${hourlyAsset.path} could not be fetched (HTTP ${response.status})`)
        }

        const buffer = await response.arrayBuffer()
        await verifySha256(buffer, hourlyAsset.sha256, hourlyAsset.path)
        const text = new TextDecoder().decode(buffer)
        const data = parseAirHourlyCsv(text, dailyLoaded.data.stations, hourlyAsset.path)
        if (!controller.signal.aborted) setHourly({ path: hourlyAsset.path, data, bytes: buffer.byteLength })
      } catch (error) {
        if (controller.signal.aborted) return
        setReason(error instanceof Error ? error.message : String(error))
        setReasonPath(hourlyAsset.path)
      }
    })()

    return () => controller.abort()
  }, [dailyLoaded, enabled, granularity, hourlyAsset, hourlyAsset?.path, hourlyAsset?.sha256])

  const dataset = useMemo<AirDataset | null>(() => dailyLoaded ? {
    daily: dailyLoaded.data,
    hourly: granularity === 'hourly' && hourlyLoaded ? hourlyLoaded.data : null,
    dailyBytes: dailyLoaded.bytes,
    hourlyBytes: granularity === 'hourly' && hourlyLoaded ? hourlyLoaded.bytes : null,
    sourceFiles: [dailyLoaded.path, ...(granularity === 'hourly' && hourlyLoaded ? [hourlyLoaded.path] : [])],
  } : null, [dailyLoaded, granularity, hourlyLoaded])

  if (!enabled) return { status: 'loading', dataset: null, reason: null, granularity }
  if (releaseStatus === 'error') {
    return { status: 'error', dataset: null, reason: releaseReason ?? 'Release manifest could not be read.', granularity }
  }
  if (releaseStatus === 'empty' || !release) {
    return { status: 'unavailable', dataset: null, reason: 'No validated data release is published yet.', granularity }
  }
  if (!dailyAsset) {
    return {
      status: 'unavailable',
      dataset: null,
      reason: `Release ${release.release_id} does not publish an air measurements asset.`,
      granularity,
    }
  }
  if (!dailyLoaded) {
    return { status: 'loading', dataset: null, reason: null, granularity }
  }
  if (reason && reasonPath === dailyAsset.path) {
    return { status: 'error', dataset: null, reason, granularity }
  }
  if (granularity === 'hourly') {
    if (!hourlyAsset) {
      return {
        status: 'unavailable',
        dataset: null,
        reason: `Release ${release.release_id} does not publish an hourly air measurements asset.`,
        granularity,
      }
    }
    if (!hourlyLoaded) return { status: 'loading', dataset, reason: null, granularity }
    if (reason && reasonPath === hourlyAsset.path) return { status: 'error', dataset: null, reason, granularity }
  }

  return { status: 'ready', dataset, reason: null, granularity }
}
