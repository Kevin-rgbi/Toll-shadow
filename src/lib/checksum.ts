import { ReleaseManifestError } from './releaseManifest'

const toHex = (buffer: ArrayBuffer): string => {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const verifySha256 = async (buffer: ArrayBuffer, expected: string, assetLabel: string): Promise<void> => {
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
