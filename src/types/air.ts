export interface MonitorEffect {
  monitorId: string
  name: string
  period: string
  observedPm25: number
  expectedPm25: number
  effect: number
  confidence: number
  classification: 'improved' | 'worsened' | 'no_change' | 'insufficient'
  coordinates: [number, number]
}