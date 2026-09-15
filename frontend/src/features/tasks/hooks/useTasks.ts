import { useQuery } from '@tanstack/react-query'
import { api } from '../../../services/api'
import type { ApiSuccessResponse, PaginatedResult } from '../../../types/api'
import type { ActivityTaskSummary } from '../../../types/office'

export function useTasks() {
  return useQuery({
    queryKey: ['tasks', 'picker'],
    queryFn: async () => {
      const response = await api.get<
        ApiSuccessResponse<PaginatedResult<ActivityTaskSummary>>
      >('/tasks', {
        params: { limit: 100 },
      })
      return response.data.data.items
    },
    staleTime: 60 * 1000,
  })
}
