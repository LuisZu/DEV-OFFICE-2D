// Mirrors backend/src/office/constants/office-events.constant.ts — kept as a
// separate small file on each side since frontend and backend don't share a
// package, but the string values must match exactly.
export const OFFICE_EVENTS = {
  DEVELOPER_CONNECTED: 'developer.connected',
  DEVELOPER_DISCONNECTED: 'developer.disconnected',
  DEVELOPER_STATUS_CHANGED: 'developer.status.changed',
  DEVELOPER_ACTIVITY_STARTED: 'developer.activity.started',
  DEVELOPER_ACTIVITY_FINISHED: 'developer.activity.finished',
  DEVELOPER_TASK_CHANGED: 'developer.task.changed',
  SYNC_REQUEST: 'office.sync.request',
  SYNC_RESPONSE: 'office.sync.response',
} as const
