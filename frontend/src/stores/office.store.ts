import { create } from 'zustand'
import type {
  ConnectionStatus,
  CurrentActivitySummary,
  OfficeDeveloper,
} from '../types/office'

interface OfficeState {
  developers: Record<string, OfficeDeveloper>
  connectionStatus: ConnectionStatus
  lastSync: string | null
  setDevelopers: (developers: OfficeDeveloper[]) => void
  setDeveloperActivity: (
    developerId: string,
    activity: CurrentActivitySummary | null,
  ) => void
  // Merges a partial activity update (e.g. developer.task.changed doesn't carry
  // `status`) onto whatever the developer's current activity already was, instead
  // of overwriting fields the event payload didn't include.
  patchDeveloperActivity: (
    developerId: string,
    patch: Partial<CurrentActivitySummary>,
  ) => void
  setConnectionStatus: (status: ConnectionStatus) => void
  setLastSync: (timestamp: string) => void
}

export const useOfficeStore = create<OfficeState>()((set) => ({
  developers: {},
  connectionStatus: 'connecting',
  lastSync: null,

  setDevelopers: (developers) =>
    set({
      developers: Object.fromEntries(
        developers.map((developer) => [developer.id, developer]),
      ),
    }),

  setDeveloperActivity: (developerId, activity) =>
    set((state) => {
      const existing = state.developers[developerId]
      if (!existing) return state
      return {
        developers: {
          ...state.developers,
          [developerId]: { ...existing, currentActivity: activity },
        },
      }
    }),

  patchDeveloperActivity: (developerId, patch) =>
    set((state) => {
      const existing = state.developers[developerId]
      if (!existing) return state
      const merged = {
        ...existing.currentActivity,
        ...patch,
      } as CurrentActivitySummary
      return {
        developers: {
          ...state.developers,
          [developerId]: { ...existing, currentActivity: merged },
        },
      }
    }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setLastSync: (timestamp) => set({ lastSync: timestamp }),
}))
