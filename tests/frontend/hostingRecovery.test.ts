import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const firebase = JSON.parse(readFileSync('firebase.json', 'utf8'))

describe('legacy hosting recovery', () => {
  it('ships a one-time page that clears stale workers and browser caches', () => {
    const resetHeaders = firebase.hosting.headers.find((entry: { source: string }) => entry.source === '/reset.html')
    expect(resetHeaders?.headers).toEqual(expect.arrayContaining([
      { key: 'Cache-Control', value: 'no-store, max-age=0' },
      { key: 'Clear-Site-Data', value: '"cache", "storage"' },
    ]))

    const page = readFileSync('public/reset.html', 'utf8')
    const script = readFileSync('public/recovery-20260921.js', 'utf8')
    expect(page).toContain('src="/recovery-20260921.js"')
    expect(script).toContain('navigator.serviceWorker.getRegistrations()')
    expect(script).toContain('registration.unregister()')
    expect(script).toContain('caches.keys()')
    expect(script).toContain("window.location.replace('/?recovered=2026-09-21.1')")
  })
})
