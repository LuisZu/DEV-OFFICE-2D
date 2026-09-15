import { useCallback } from 'react'
import { api } from '../services/api'
import { useAuthStore } from '../stores/auth.store'
import type { ApiSuccessResponse } from '../types/api'
import type { LoginResponse } from '../types/auth'

export function useAuth() {
  const user = useAuthStore((state) => state.user)
  const accessToken = useAuthStore((state) => state.accessToken)
  const refreshToken = useAuthStore((state) => state.refreshToken)
  const setSession = useAuthStore((state) => state.setSession)
  const clearSession = useAuthStore((state) => state.clearSession)

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await api.post<ApiSuccessResponse<LoginResponse>>(
        '/auth/login',
        { email, password },
      )
      setSession(response.data.data)
    },
    [setSession],
  )

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', refreshToken ? { refreshToken } : {})
    } catch {
      // Best-effort server-side revocation; the local session is cleared regardless.
    } finally {
      clearSession()
    }
  }, [refreshToken, clearSession])

  return { user, isAuthenticated: Boolean(accessToken && user), login, logout }
}
