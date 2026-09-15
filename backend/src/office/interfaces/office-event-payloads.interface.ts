// Payload shapes for the events in OFFICE_EVENTS. Deliberately small and
// non-sensitive (spec section 19: "No enviar información sensible") — no
// password/email/token fields ever cross the socket.

export interface ActivityStatusSummary {
  id: string;
  code: string;
  name: string;
  icon: string | null;
  color: string | null;
}

export interface ActivityTaskSummary {
  id: string;
  code: string;
  title: string;
}

export interface DeveloperConnectionPayload {
  developerId: string;
  at: string;
}

export interface DeveloperActivityStartedPayload {
  developerId: string;
  activityId: string;
  status: ActivityStatusSummary;
  task: ActivityTaskSummary | null;
  startedAt: string;
}

export interface DeveloperActivityFinishedPayload {
  developerId: string;
  activityId: string;
  endedAt: string;
  durationSeconds: number;
}

export interface DeveloperStatusChangedPayload {
  developerId: string;
  activityId: string;
  status: ActivityStatusSummary;
  task: ActivityTaskSummary | null;
  startedAt: string;
}

export interface DeveloperTaskChangedPayload {
  developerId: string;
  activityId: string;
  task: ActivityTaskSummary | null;
  startedAt: string;
}

export interface MeetingStartedPayload {
  meetingId: string;
  title: string;
  startedAt: string;
  participantIds: string[];
}

export interface MeetingFinishedPayload {
  meetingId: string;
  title: string;
  endedAt: string;
  participantIds: string[];
}

export interface MeetingParticipantPayload {
  meetingId: string;
  developerId: string;
}
