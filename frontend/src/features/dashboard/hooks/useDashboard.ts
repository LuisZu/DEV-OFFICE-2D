import { useQuery } from '@tanstack/react-query'
import { api } from '../../../services/api'
import type { ApiSuccessResponse } from '../../../types/api'
import type {
  ActivityStatusSummary,
  OfficeDeveloper,
} from '../../../types/office'

export interface DashboardSummary {
  totalDevelopers: number
  byStatus: (ActivityStatusSummary & { count: number })[]
  withoutActivity: number
}

export interface ActivityDistributionEntry {
  status: { id: string; code: string; name: string; color: string | null }
  totalSeconds: number
  count: number
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const res =
        await api.get<ApiSuccessResponse<DashboardSummary>>(
          '/dashboard/summary',
        )
      return res.data.data
    },
    refetchInterval: 30_000,
  })
}

export function useActiveActivities() {
  return useQuery({
    queryKey: ['dashboard', 'active-activities'],
    queryFn: async () => {
      const res = await api.get<ApiSuccessResponse<OfficeDeveloper[]>>(
        '/dashboard/active-activities',
      )
      return res.data.data
    },
    refetchInterval: 30_000,
  })
}

export function useActivityDistribution() {
  return useQuery({
    queryKey: ['dashboard', 'activity-distribution'],
    queryFn: async () => {
      const res = await api.get<
        ApiSuccessResponse<ActivityDistributionEntry[]>
      >('/dashboard/activity-distribution')
      return res.data.data
    },
  })
}
