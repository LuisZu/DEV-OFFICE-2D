import { useQuery } from '@tanstack/react-query'
import { api } from '../../../services/api'
import type { ApiSuccessResponse, PaginatedResult } from '../../../types/api'

export interface DeveloperOption {
  id: string
  firstName: string
  lastName: string
}

export function useDevelopers() {
  return useQuery({
    queryKey: ['developers', 'picker'],
    queryFn: async () => {
      const response = await api.get<ApiSuccessResponse<PaginatedResult<DeveloperOption>>>('/developers', {
        params: { limit: 100 },
      })
      return response.data.data.items
    },
    staleTime: 60 * 1000,
  })
}
