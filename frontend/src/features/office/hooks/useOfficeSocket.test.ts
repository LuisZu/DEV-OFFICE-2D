import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useOfficeSocket } from './useOfficeSocket'
import { useOfficeStore } from '../../../stores/office.store'
import { OFFICE_EVENTS } from '../constants/office-events'

type Handler = (...args: unknown[]) => void

class FakeSocket {
  connected = false
  private handlers = new Map<string, Set<Handler>>()
  public emitted: Array<{ event: string; args: unknown[] }> = []

  on(event: string, handler: Handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(handler)
  }

  off(event: string, handler: Handler) {
    this.handlers.get(event)?.delete(handler)
  }

  emit(event: string, ...args: unknown[]) {
    this.emitted.push({ event, args })
  }

  disconnect() {
    this.connected = false
  }

  // test helper: simulate the server/transport firing an event
  trigger(event: string, ...args: unknown[]) {
    if (event === 'connect') this.connected = true
    if (event === 'disconnect') this.connected = false
    this.handlers.get(event)?.forEach((handler) => handler(...args))
  }
}

const fakeSocket = new FakeSocket()

vi.mock('../../../services/socket', () => ({
  connectOfficeSocket: () => fakeSocket,
  disconnectOfficeSocket: () => fakeSocket.disconnect(),
}))

describe('useOfficeSocket', () => {
  beforeEach(() => {
    fakeSocket.connected = false
    fakeSocket.emitted = []
    useOfficeStore.setState({
      developers: {},
      connectionStatus: 'connecting',
      lastSync: null,
    })
  })

  it('requests a sync snapshot as soon as the socket connects', () => {
    renderHook(() => useOfficeSocket())

    fakeSocket.trigger('connect')

    expect(useOfficeStore.getState().connectionStatus).toBe('connected')
    expect(
      fakeSocket.emitted.some((e) => e.event === OFFICE_EVENTS.SYNC_REQUEST),
    ).toBe(true)
  })

  it('populates the store from office.sync.response', () => {
    renderHook(() => useOfficeSocket())

    fakeSocket.trigger(OFFICE_EVENTS.SYNC_RESPONSE, {
      serverTime: '2026-01-01T00:00:00.000Z',
      developers: [
        {
          id: 'dev-1',
          firstName: 'Juan',
          lastName: 'Pérez',
          email: 'juan@x.com',
          avatarUrl: null,
          isActive: true,
          position: null,
          currentActivity: null,
        },
      ],
    })

    const state = useOfficeStore.getState()
    expect(state.lastSync).toBe('2026-01-01T00:00:00.000Z')
    expect(state.developers['dev-1'].firstName).toBe('Juan')
  })

  it('updates a developer in place when developer.activity.started arrives', () => {
    useOfficeStore.setState({
      developers: {
        'dev-1': {
          id: 'dev-1',
          firstName: 'Juan',
          lastName: 'Pérez',
          email: 'juan@x.com',
          avatarUrl: null,
          isActive: true,
          position: null,
          currentActivity: null,
        },
      },
    })

    renderHook(() => useOfficeSocket())

    fakeSocket.trigger(OFFICE_EVENTS.DEVELOPER_ACTIVITY_STARTED, {
      developerId: 'dev-1',
      activityId: 'act-1',
      status: {
        id: 's1',
        code: 'WORKING',
        name: 'Trabajando',
        icon: '💻',
        color: '#22c55e',
      },
      task: null,
      startedAt: '2026-01-01T00:00:00.000Z',
    })

    expect(
      useOfficeStore.getState().developers['dev-1'].currentActivity?.status
        .code,
    ).toBe('WORKING')
  })

  it('marks the connection as disconnected and re-syncs on reconnect (spec section 21)', () => {
    renderHook(() => useOfficeSocket())

    fakeSocket.trigger('connect')
    const firstSyncCount = fakeSocket.emitted.filter(
      (e) => e.event === OFFICE_EVENTS.SYNC_REQUEST,
    ).length
    expect(firstSyncCount).toBe(1)

    fakeSocket.trigger('disconnect')
    expect(useOfficeStore.getState().connectionStatus).toBe('disconnected')

    // socket.io's own reconnection logic fires 'connect' again — the hook must
    // never assume the state it already has is still correct, so it re-syncs.
    fakeSocket.trigger('connect')
    expect(useOfficeStore.getState().connectionStatus).toBe('connected')
    const secondSyncCount = fakeSocket.emitted.filter(
      (e) => e.event === OFFICE_EVENTS.SYNC_REQUEST,
    ).length
    expect(secondSyncCount).toBe(2)
  })

  it('unregisters its listeners and disconnects on unmount', async () => {
    const { unmount } = renderHook(() => useOfficeSocket())
    fakeSocket.trigger('connect')

    unmount()

    // after unmount, further server events must not reach the (unmounted) store update
    useOfficeStore.setState({ connectionStatus: 'connected' })
    fakeSocket.trigger('disconnect')
    await waitFor(() => {
      expect(useOfficeStore.getState().connectionStatus).toBe('connected')
    })
  })
})
