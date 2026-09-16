import { useEffect, useState } from 'react'
import { getReleaseAssets, ReleaseManifestError } from '../lib/releaseManifest'
import type { ReleaseAssetKind, ReleaseManifest } from '../lib/releaseManifest'

/**
 * Loads one published release asset, verifies its declared SHA-256, parses it into a canonical
 * domain model, and reports the outcome honestly.
 *
 * - `unavailable` means this release publishes no asset of that kind. It is a normal, reportable
 *   state, not an error: the module says so rather than substituting anything.
 * - `error` means the asset was unreachable, failed its checksum, or failed parsing. No view may
 *   fall back to cached or bundled content on this state.
 *
 * `parse` must be a module-level function so its identity is stable across renders; passing an
 * inline closure refetches on every render.
 */
export type ReleaseAssetState<T> =
  | { status: 'unavailable' }
  | { status: 'loading' }
  | { status: 'ready', data: T }
  | { status: 'error', reason: string }

type Parser<T> = (input: unknown, assetLabel: string) => T

const toHex = (buffer: ArrayBuffer): string => {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Verify fetched bytes against the manifest's declared checksum.
 *
 * A mismatch means the browser received different bytes than the release manifest describes, which
 * is exactly the class of defect a checksum exists to catch. `crypto.subtle` is undefined outside
 * a secure context, and in that case verification is refused rather than skipped.
 */
const verifySha256 = async (buffer: ArrayBuffer, expected: string, assetLabel: string): Promise<void> => {
  if (!globalThis.crypto?.subtle) {
    throw new ReleaseManifestError(
      'ASSET_MALFORMED',
      `${assetLabel}: cannot verify the declared checksum outside a secure context`,
    )
  }

  const actual = toHex(await globalThis.crypto.subtle.digest('SHA-256', buffer))
  if (actual !== expected) {
    throw new ReleaseManifestError(
      'ASSET_MALFORMED',
      `${assetLabel}: checksum mismatch (manifest ${expected}, received ${actual})`,
    )
  }
}

export function useReleaseAsset<T>(
  release: ReleaseManifest | null,
  kind: ReleaseAssetKind,
  parse: Parser<T>,
): ReleaseAssetState<T> {
  const asset = release ? getReleaseAssets(release, kind)[0] ?? null : null
  const path = asset?.path ?? null
  const declaredSha = asset?.sha256 ?? null

  // Only completed loads are stored. `loading` and `unavailable` are derived from the current asset
  // path, so the effect never sets state synchronously during a render commit.
  const [loaded, setLoaded] = useState<{ path: string, result: ReleaseAssetState<T> } | null>(null)
  const isCurrent = path !== null && loaded?.path === path

  useEffect(() => {
    if (!path || !declaredSha) return

    let cancelled = false

    const run = async () => {
      try {
        const response = await fetch(path)
        if (!response.ok) {
          throw new ReleaseManifestError('ASSET_UNREACHABLE', `${path} could not be fetched (HTTP ${response.status})`)
        }

        const buffer = await response.arrayBuffer()
        await verifySha256(buffer, declaredSha, path)

        const payload: unknown = JSON.parse(new TextDecoder().decode(buffer))
        const data = parse(payload, path)
        if (cancelled) return
        setLoaded({ path, result: { status: 'ready', data } })
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : String(error)
        setLoaded({ path, result: { status: 'error', reason: message } })
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [declaredSha, parse, path])

  if (path === null) return { status: 'unavailable' }
  if (!isCurrent) return { status: 'loading' }
  return loaded.result
}
