export interface ActivityStatusSummary {
  id: string
  code: string
  name: string
  icon: string | null
  color: string | null
}

export interface ActivityTaskSummary {
  id: string
  code: string
  title: string
}

export interface CurrentActivitySummary {
  id: string
  status: ActivityStatusSummary
  task: ActivityTaskSummary | null
  startedAt: string
}

export interface OfficePositionSummary {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  area: string | null
}

export interface OfficeDeveloper {
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl: string | null
  isActive: boolean
  position: OfficePositionSummary | null
  currentActivity: CurrentActivitySummary | null
}

export interface OfficeState {
  areas: readonly string[]
  developers: OfficeDeveloper[]
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'
