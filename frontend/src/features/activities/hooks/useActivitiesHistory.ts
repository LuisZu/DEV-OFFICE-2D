import { useQuery } from '@tanstack/react-query'
import { api } from '../../../services/api'
import type { ApiSuccessResponse, PaginatedResult } from '../../../types/api'
import type { RecentActivity } from '../../dashboard/hooks/useRecentActivities'

export interface ActivitiesFilters {
  developerId?: string
  statusId?: string
  projectId?: string
  taskId?: string
  dateFrom?: string
  dateTo?: string
  page: number
  limit: number
}

export function useActivitiesHistory(filters: ActivitiesFilters) {
  return useQuery({
    queryKey: ['activities', 'history', filters],
    queryFn: async () => {
      const response = await api.get<ApiSuccessResponse<PaginatedResult<RecentActivity>>>('/activities', {
        params: filters,
      })
      return response.data.data
    },
    placeholderData: (previous) => previous,
  })
}
