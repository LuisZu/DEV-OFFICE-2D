import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../../services/api'
import { useAuthStore } from '../../../stores/auth.store'
import { UserRole } from '../../../types/auth'
import type { ApiSuccessResponse } from '../../../types/api'
import type { CurrentActivitySummary } from '../../../types/office'

const CURRENT_ACTIVITY_KEY = ['activities', 'current']

// GET /activities/current only makes sense for a user with a Developer profile
// (the backend rejects everyone else with 403 NOT_A_DEVELOPER) — ADMIN/MANAGER/
// VIEWER accounts have no "own activity" concept, so the query stays disabled
// for them instead of firing a request that's guaranteed to fail.
export function useCurrentActivity() {
  const isDeveloper = useAuthStore(
    (state) => state.user?.roles.includes(UserRole.DEVELOPER) ?? false,
  )

  return useQuery({
    queryKey: CURRENT_ACTIVITY_KEY,
    queryFn: async () => {
      const response = await api.get<
        ApiSuccessResponse<CurrentActivitySummary | null>
      >('/activities/current')
      return response.data.data
    },
    enabled: isDeveloper,
  })
}

interface StartActivityInput {
  statusId: string
  taskId?: string
  description?: string
}

export function useActivityMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: CURRENT_ACTIVITY_KEY })

  const start = useMutation({
    mutationFn: (input: StartActivityInput) => api.post('/activities', input),
    onSuccess: invalidate,
  })

  const finish = useMutation({
    mutationFn: ({ activityId, note }: { activityId: string; note?: string }) =>
      api.post(`/activities/${activityId}/finish`, { note }),
    onSuccess: invalidate,
  })

  const changeStatus = useMutation({
    mutationFn: (input: {
      statusId: string
      taskId?: string | null
      description?: string
    }) => api.post('/activities/current/change-status', input),
    onSuccess: invalidate,
  })

  const changeTask = useMutation({
    mutationFn: (taskId: string | null) =>
      api.post('/activities/current/change-task', { taskId }),
    onSuccess: invalidate,
  })

  return { start, finish, changeStatus, changeTask }
}
