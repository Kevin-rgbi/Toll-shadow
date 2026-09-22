async function clearLegacySiteState() {
  const tasks = []

  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    tasks.push(...registrations.map((registration) => registration.unregister()))
  }

  if ('caches' in window) {
    const keys = await caches.keys()
    tasks.push(...keys.map((key) => caches.delete(key)))
  }

  await Promise.allSettled(tasks)
  window.location.replace('/?recovered=2026-09-21.1')
}

void clearLegacySiteState()
