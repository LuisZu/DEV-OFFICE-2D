import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LoginPage } from './LoginPage'
import { useAuthStore } from '../stores/auth.store'
import { api } from '../services/api'

vi.mock('../services/api', async () => {
  const actual =
    await vi.importActual<typeof import('../services/api')>('../services/api')
  return {
    ...actual,
    api: { post: vi.fn() },
  }
})

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

describe('LoginPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, refreshToken: null, user: null })
    navigateMock.mockClear()
    vi.mocked(api.post).mockReset()
  })

  it('renders the login form', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument()
  })

  it('logs in and navigates to the office on success', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          user: {
            id: 'u1',
            email: 'admin@devoffice.local',
            firstName: 'Admin',
            lastName: 'DevOffice',
            roles: ['ADMIN'],
          },
        },
      },
    })

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await userEvent.type(
      screen.getByLabelText(/email/i),
      'admin@devoffice.local',
    )
    await userEvent.type(
      screen.getByLabelText(/contraseña/i),
      'ChangeMe#Admin1',
    )
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => {
      expect(useAuthStore.getState().accessToken).toBe('access-token')
    })
    expect(navigateMock).toHaveBeenCalledWith('/', { replace: true })
  })

  it('shows an error message when login fails and does not navigate', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        data: {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password.',
          },
        },
      },
    })

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await userEvent.type(
      screen.getByLabelText(/email/i),
      'admin@devoffice.local',
    )
    await userEvent.type(screen.getByLabelText(/contraseña/i), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }))

    expect(
      await screen.findByText(/error inesperado|invalid email or password/i),
    ).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
    expect(useAuthStore.getState().accessToken).toBeNull()
  })
})
