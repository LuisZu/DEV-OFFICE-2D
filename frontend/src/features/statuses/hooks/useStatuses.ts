import { useQuery } from '@tanstack/react-query'
import { api } from '../../../services/api'
import type { ApiSuccessResponse } from '../../../types/api'
import type { ActivityStatusSummary } from '../../../types/office'

interface DeveloperStatusRecord extends ActivityStatusSummary {
  isActive: boolean
  requiresTask: boolean
}

export function useStatuses() {
  return useQuery({
    queryKey: ['statuses'],
    queryFn: async () => {
      const response =
        await api.get<ApiSuccessResponse<DeveloperStatusRecord[]>>('/statuses')
      return response.data.data.filter((status) => status.isActive)
    },
    staleTime: 5 * 60 * 1000,
  })
}
