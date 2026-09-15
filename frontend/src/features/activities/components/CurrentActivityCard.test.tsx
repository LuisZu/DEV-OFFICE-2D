import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CurrentActivityCard } from './CurrentActivityCard'
import { useAuthStore } from '../../../stores/auth.store'
import {
  useCurrentActivity,
  useActivityMutations,
} from '../hooks/useCurrentActivity'
import { useStatuses } from '../../statuses/hooks/useStatuses'
import { useTasks } from '../../tasks/hooks/useTasks'

vi.mock('../hooks/useCurrentActivity')
vi.mock('../../statuses/hooks/useStatuses')
vi.mock('../../tasks/hooks/useTasks')

const startMutateAsync = vi.fn().mockResolvedValue(undefined)
const finishMutateAsync = vi.fn().mockResolvedValue(undefined)
const changeStatusMutateAsync = vi.fn().mockResolvedValue(undefined)

function mockMutations() {
  vi.mocked(useActivityMutations).mockReturnValue({
    start: { mutateAsync: startMutateAsync } as never,
    finish: { mutateAsync: finishMutateAsync } as never,
    changeStatus: { mutateAsync: changeStatusMutateAsync } as never,
    changeTask: { mutateAsync: vi.fn() } as never,
  })
  vi.mocked(useStatuses).mockReturnValue({
    data: [
      {
        id: 's1',
        code: 'WORKING',
        name: 'Trabajando',
        icon: '💻',
        color: '#22c55e',
        isActive: true,
        requiresTask: true,
      },
      {
        id: 's2',
        code: 'COFFEE',
        name: 'Café',
        icon: '☕',
        color: '#a16207',
        isActive: true,
        requiresTask: false,
      },
    ],
  } as never)
  vi.mocked(useTasks).mockReturnValue({
    data: [{ id: 't1', code: 'DVOF-1', title: 'Implementar login' }],
  } as never)
}

describe('CurrentActivityCard', () => {
  beforeEach(() => {
    startMutateAsync.mockClear()
    finishMutateAsync.mockClear()
    mockMutations()
  })

  it('renders nothing for a non-developer account', () => {
    useAuthStore.setState({
      user: {
        id: 'u1',
        email: 'admin@devoffice.local',
        firstName: 'Admin',
        lastName: 'A',
        roles: ['ADMIN' as never],
      },
    })
    vi.mocked(useCurrentActivity).mockReturnValue({
      data: null,
      isLoading: false,
    } as never)

    const { container } = render(<CurrentActivityCard />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lets a developer start an activity', async () => {
    useAuthStore.setState({
      user: {
        id: 'u1',
        email: 'dev@devoffice.local',
        firstName: 'Dev',
        lastName: 'D',
        roles: ['DEVELOPER' as never],
      },
    })
    vi.mocked(useCurrentActivity).mockReturnValue({
      data: null,
      isLoading: false,
    } as never)

    render(<CurrentActivityCard />)

    expect(
      screen.getByText(/no tienes una actividad activa/i),
    ).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: /empezar a trabajar/i }),
    )

    expect(await screen.findByText(/qué vas a hacer/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('combobox', { name: /estado/i }))
    await userEvent.click(await screen.findByRole('option', { name: /café/i }))
    await userEvent.click(screen.getByRole('button', { name: /^empezar$/i }))

    expect(startMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ statusId: 's2' }),
    )
  })

  it('shows the active status and lets the developer finish it', async () => {
    useAuthStore.setState({
      user: {
        id: 'u1',
        email: 'dev@devoffice.local',
        firstName: 'Dev',
        lastName: 'D',
        roles: ['DEVELOPER' as never],
      },
    })
    vi.mocked(useCurrentActivity).mockReturnValue({
      data: {
        id: 'act-1',
        status: {
          id: 's1',
          code: 'WORKING',
          name: 'Trabajando',
          icon: '💻',
          color: '#22c55e',
        },
        task: { id: 't1', code: 'DVOF-1', title: 'Implementar login' },
        startedAt: new Date().toISOString(),
      },
      isLoading: false,
    } as never)

    render(<CurrentActivityCard />)

    expect(screen.getByText(/trabajando/i)).toBeInTheDocument()
    expect(screen.getByText(/DVOF-1/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /finalizar/i }))

    expect(finishMutateAsync).toHaveBeenCalledWith({ activityId: 'act-1' })
  })
})
