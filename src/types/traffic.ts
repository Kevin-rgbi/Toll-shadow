export type EvidenceClassification =
  | 'improved'
  | 'worsened'
  | 'no_material_change'
  | 'insufficient_evidence'

export interface TrafficEffect {
  locationId: string
  name: string
  borough: string
  period: string
  observed: number
  expected: number
  effectPct: number
  confidence: number
  classification: EvidenceClassification
  coordinates: [number, number][]
}