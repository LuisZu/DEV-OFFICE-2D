import { useQuery } from '@tanstack/react-query'
import { api } from '../../../services/api'
import type { ApiSuccessResponse, PaginatedResult } from '../../../types/api'
import type {
  ActivityStatusSummary,
  ActivityTaskSummary,
} from '../../../types/office'

export interface RecentActivity {
  id: string
  startedAt: string
  endedAt: string | null
  durationSeconds: number | null
  status: ActivityStatusSummary
  task: ActivityTaskSummary | null
  developer: { id: string; user: { firstName: string; lastName: string } }
}

// Reuses GET /api/activities (built in Fase 6) rather than adding a dedicated
// dashboard endpoint for the same data.
export function useRecentActivities(limit = 10) {
  return useQuery({
    queryKey: ['dashboard', 'recent-activities', limit],
    queryFn: async () => {
      const res = await api.get<
        ApiSuccessResponse<PaginatedResult<RecentActivity>>
      >('/activities', {
        params: { limit, page: 1 },
      })
      return res.data.data.items
    },
    refetchInterval: 30_000,
  })
}
