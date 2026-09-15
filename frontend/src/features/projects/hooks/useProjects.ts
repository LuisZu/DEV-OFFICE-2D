import { useQuery } from '@tanstack/react-query'
import { api } from '../../../services/api'
import type { ApiSuccessResponse, PaginatedResult } from '../../../types/api'

export interface ProjectOption {
  id: string
  code: string
  name: string
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects', 'picker'],
    queryFn: async () => {
      const response = await api.get<ApiSuccessResponse<PaginatedResult<ProjectOption>>>('/projects', {
        params: { limit: 100 },
      })
      return response.data.data.items
    },
    staleTime: 60 * 1000,
  })
}
