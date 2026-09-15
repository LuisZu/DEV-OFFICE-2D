// Event names shared between the internal EventEmitter (domain events emitted by
// business services) and the Socket.IO payloads broadcast by OfficeGateway. Keeping
// them as one set of constants avoids duplicated string literals across modules
// (spec section 18).
export const OFFICE_EVENTS = {
  DEVELOPER_CONNECTED: 'developer.connected',
  DEVELOPER_DISCONNECTED: 'developer.disconnected',

  DEVELOPER_STATUS_CHANGED: 'developer.status.changed',

  DEVELOPER_ACTIVITY_STARTED: 'developer.activity.started',
  DEVELOPER_ACTIVITY_FINISHED: 'developer.activity.finished',
  DEVELOPER_ACTIVITY_CHANGED: 'developer.activity.changed',

  DEVELOPER_TASK_CHANGED: 'developer.task.changed',

  // Not emitted yet — Meetings is Fase 10. Kept here so the gateway/event surface
  // doesn't change shape when that module lands.
  MEETING_STARTED: 'meeting.started',
  MEETING_FINISHED: 'meeting.finished',
  MEETING_PARTICIPANT_JOINED: 'meeting.participant.joined',
  MEETING_PARTICIPANT_LEFT: 'meeting.participant.left',

  // Not emitted yet — office desk positions are Fase 8.
  OFFICE_DEVELOPER_POSITION_CHANGED: 'office.developer.position.changed',

  // Client -> server reconnect sync handshake (spec section 21).
  SYNC_REQUEST: 'office.sync.request',
  SYNC_RESPONSE: 'office.sync.response',
} as const;

export const OFFICE_ROOMS = {
  MAIN: 'office:main',
  developer: (developerId: string) => `developer:${developerId}`,
} as const;
