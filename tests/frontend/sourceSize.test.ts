import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Source size, enforced rather than remembered.
 *
 * The guideline is 200-400 lines typical and 800 hard, and `MapShell` sits at the ceiling. A rule
 * nobody runs is a rule nobody follows, so this test walks the source tree: nothing may cross the
 * hard limit, and a file that is already over the typical range may not grow. The recorded sizes
 * are a ratchet, not a target - lowering one is always allowed, raising one is a decision.
 */

const HARD_LIMIT = 800
const TYPICAL_LIMIT = 400

/**
 * Files over the typical range when the ratchet was introduced, with the size they may not exceed.
 * `MapShell` and `RasterMap` hold the map lifecycle and both renderers, and splitting them touches
 * the code that has produced most of this project's defects; that is a scheduled refactor, not
 * something to do late in a session. The stylesheet that used to sit at 1,612 lines is now the
 * nine-file system under `src/styles/`, so it no longer appears here.
 */
/**
 * `MapShell` has left this list: it went from 791 lines to 362 by moving its drawing routine, its map
 * lifecycle, and its release layers into modules of their own, each verified against the behaviour it
 * replaced. `releaseData` sits at 483 after the equity parser grew a ring-structure validator: a
 * published geometry whose `coordinates` is an array of anything at all used to pass the shape check
 * and then throw during render, which reaches a reader as a blank module. Validating the published
 * contract is that file's job, so the allowance was raised deliberately rather than the helper split
 * out. `App` and `RasterMap` keep theirs: the app shell wires every surface together, and the raster
 * renderer is the fallback whole.
 */
const RECORDED: Record<string, number> = {
  'src/App.tsx': 640,
  'src/components/Map/RasterMap.tsx': 620,
  'src/lib/releaseData.ts': 490,
}

const sourceFiles = (root: string): string[] => {
  const found: string[] = []
  for (const entry of readdirSync(root)) {
    const path = join(root, entry)
    if (statSync(path).isDirectory()) {
      if (entry === '.fossil' || entry === 'node_modules') continue
      found.push(...sourceFiles(path))
      continue
    }
    if (/\.(ts|tsx|css)$/.test(entry)) found.push(path)
  }
  return found
}

const lineCount = (path: string) => readFileSync(path, 'utf8').split('\n').length
const key = (path: string) => relative(process.cwd(), path).split(sep).join('/')

describe('source file sizes', () => {
  const files = sourceFiles('src').map((path) => ({ key: key(path), lines: lineCount(path) }))

  it('no source file crosses the hard limit', () => {
    const oversized = files.filter((file) => file.lines > HARD_LIMIT)
    expect(
      oversized.map((file) => `${file.key} (${file.lines} lines)`),
      'a file over the hard limit must be split before anything else is added to it',
    ).toEqual([])
  })

  it('no file over the typical range grows past its recorded size', () => {
    const grown = files
      .filter((file) => file.key in RECORDED && file.lines > RECORDED[file.key])
      .map((file) => `${file.key}: ${file.lines} lines, recorded allowance ${RECORDED[file.key]}`)

    expect(grown, 'these files grew past their recorded allowance; split them or lower the reason').toEqual([])
  })

  it('the recorded list carries no file that is now inside the typical range', () => {
    const stale = Object.keys(RECORDED).filter((recorded) => {
      const file = files.find((candidate) => candidate.key === recorded)
      return !file || file.lines <= TYPICAL_LIMIT
    })

    expect(stale, 'these files are back inside the typical range and must leave the recorded list').toEqual([])
  })
})
