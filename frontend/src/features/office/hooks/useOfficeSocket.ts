import { useEffect } from 'react'
import {
  connectOfficeSocket,
  disconnectOfficeSocket,
} from '../../../services/socket'
import { useOfficeStore } from '../../../stores/office.store'
import { OFFICE_EVENTS } from '../constants/office-events'
import type {
  ActivityStatusSummary,
  ActivityTaskSummary,
  OfficeDeveloper,
} from '../../../types/office'

interface SyncResponse {
  developers: OfficeDeveloper[]
  serverTime: string
}

interface ActivityStartedPayload {
  developerId: string
  activityId: string
  status: ActivityStatusSummary
  task: ActivityTaskSummary | null
  startedAt: string
}

interface ActivityFinishedPayload {
  developerId: string
}

type StatusChangedPayload = ActivityStartedPayload

interface TaskChangedPayload {
  developerId: string
  activityId: string
  task: ActivityTaskSummary | null
  startedAt: string
}

// Owns the single Socket.IO connection for the office view: connects on mount,
// requests a full snapshot on every (re)connect rather than trusting whatever
// events might have been missed while offline (spec sections 14/21/50), and keeps
// office.store in sync with the real-time events for as long as it's mounted.
export function useOfficeSocket() {
  const setDevelopers = useOfficeStore((state) => state.setDevelopers)
  const setDeveloperActivity = useOfficeStore(
    (state) => state.setDeveloperActivity,
  )
  const patchDeveloperActivity = useOfficeStore(
    (state) => state.patchDeveloperActivity,
  )
  const setConnectionStatus = useOfficeStore(
    (state) => state.setConnectionStatus,
  )
  const setLastSync = useOfficeStore((state) => state.setLastSync)

  useEffect(() => {
    const socket = connectOfficeSocket()

    const requestSync = () => socket.emit(OFFICE_EVENTS.SYNC_REQUEST)

    const handleConnect = () => {
      setConnectionStatus('connected')
      requestSync()
    }
    const handleDisconnect = () => setConnectionStatus('disconnected')
    const handleSyncResponse = (snapshot: SyncResponse) => {
      setDevelopers(snapshot.developers)
      setLastSync(snapshot.serverTime)
    }
    const handleActivityStarted = (payload: ActivityStartedPayload) =>
      setDeveloperActivity(payload.developerId, {
        id: payload.activityId,
        status: payload.status,
        task: payload.task,
        startedAt: payload.startedAt,
      })
    const handleActivityFinished = (payload: ActivityFinishedPayload) =>
      setDeveloperActivity(payload.developerId, null)
    const handleStatusChanged = (payload: StatusChangedPayload) =>
      setDeveloperActivity(payload.developerId, {
        id: payload.activityId,
        status: payload.status,
        task: payload.task,
        startedAt: payload.startedAt,
      })
    const handleTaskChanged = (payload: TaskChangedPayload) =>
      patchDeveloperActivity(payload.developerId, {
        id: payload.activityId,
        task: payload.task,
        startedAt: payload.startedAt,
      })

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on(OFFICE_EVENTS.SYNC_RESPONSE, handleSyncResponse)
    socket.on(OFFICE_EVENTS.DEVELOPER_ACTIVITY_STARTED, handleActivityStarted)
    socket.on(OFFICE_EVENTS.DEVELOPER_ACTIVITY_FINISHED, handleActivityFinished)
    socket.on(OFFICE_EVENTS.DEVELOPER_STATUS_CHANGED, handleStatusChanged)
    socket.on(OFFICE_EVENTS.DEVELOPER_TASK_CHANGED, handleTaskChanged)

    if (socket.connected) {
      handleConnect()
    }

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off(OFFICE_EVENTS.SYNC_RESPONSE, handleSyncResponse)
      socket.off(
        OFFICE_EVENTS.DEVELOPER_ACTIVITY_STARTED,
        handleActivityStarted,
      )
      socket.off(
        OFFICE_EVENTS.DEVELOPER_ACTIVITY_FINISHED,
        handleActivityFinished,
      )
      socket.off(OFFICE_EVENTS.DEVELOPER_STATUS_CHANGED, handleStatusChanged)
      socket.off(OFFICE_EVENTS.DEVELOPER_TASK_CHANGED, handleTaskChanged)
      disconnectOfficeSocket()
    }
  }, [
    setDevelopers,
    setDeveloperActivity,
    patchDeveloperActivity,
    setConnectionStatus,
    setLastSync,
  ])

  return {
    requestSync: () => connectOfficeSocket().emit(OFFICE_EVENTS.SYNC_REQUEST),
  }
}
