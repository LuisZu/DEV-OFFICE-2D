import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../stores/auth.store'
import type { ApiSuccessResponse, ApiErrorResponse } from '../types/api'
import type { LoginResponse } from '../types/auth'

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

export const api = axios.create({ baseURL })

api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState()
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean
}

// Refresh is serialized: if several requests 401 at once, only the first triggers a
// refresh call and the rest wait on the same promise instead of each racing their own.
let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const { refreshToken, setAccessToken, clearSession } = useAuthStore.getState()
  if (!refreshToken) {
    clearSession()
    throw new Error('No refresh token available')
  }

  try {
    const response = await axios.post<ApiSuccessResponse<LoginResponse>>(
      `${baseURL}/auth/refresh`,
      {
        refreshToken,
      },
    )
    const { accessToken, refreshToken: newRefreshToken } = response.data.data
    useAuthStore.setState({ accessToken, refreshToken: newRefreshToken })
    setAccessToken(accessToken)
    return accessToken
  } catch (error) {
    clearSession()
    throw error
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const config = error.config as RetriableConfig | undefined

    if (
      error.response?.status === 401 &&
      config &&
      !config._retried &&
      !config.url?.includes('/auth/')
    ) {
      config._retried = true
      try {
        refreshPromise ??= refreshAccessToken().finally(() => {
          refreshPromise = null
        })
        const accessToken = await refreshPromise
        config.headers.Authorization = `Bearer ${accessToken}`
        return api(config)
      } catch {
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  },
)

export function getApiErrorMessage(error: unknown): string {
  if (
    axios.isAxiosError<ApiErrorResponse>(error) &&
    error.response?.data?.error
  ) {
    return error.response.data.error.message
  }
  return 'Ha ocurrido un error inesperado.'
}
