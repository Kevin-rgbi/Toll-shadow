import type { MonitorEffect } from './air'
import type { TrafficEffect } from './traffic'

export interface DemoData {
  synthetic: true
  generatedFor: 'visualization-development-only'
  policyStartDate: string
  traffic: TrafficEffect[]
  monitors: MonitorEffect[]
}