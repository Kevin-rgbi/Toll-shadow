import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  if (mode === 'production' && env.USE_DEMO_DATA === 'true') {
    throw new Error('Production builds cannot run with USE_DEMO_DATA=true.')
  }

  return {
    plugins: [react()],
    optimizeDeps: {
      exclude: ['maplibre-gl'],
    },
  }
})
