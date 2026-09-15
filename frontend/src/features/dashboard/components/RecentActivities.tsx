import { List, ListItem, ListItemText, Paper, Typography } from '@mui/material'
import type { RecentActivity } from '../hooks/useRecentActivities'

function formatDuration(seconds: number | null): string {
  if (seconds === null) return 'en curso'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

export function RecentActivities({
  activities,
}: {
  activities: RecentActivity[]
}) {
  if (activities.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography color="text.secondary">
          Todavía no hay actividad registrada.
        </Typography>
      </Paper>
    )
  }

  return (
    <Paper variant="outlined">
      <List dense disablePadding>
        {activities.map((activity) => (
          <ListItem key={activity.id} divider>
            <ListItemText
              primary={`${activity.status.icon ?? ''} ${activity.developer.user.firstName} ${activity.developer.user.lastName} — ${activity.status.name}`.trim()}
              secondary={
                <>
                  {activity.task
                    ? `${activity.task.code} — ${activity.task.title} · `
                    : ''}
                  {new Date(activity.startedAt).toLocaleString()} ·{' '}
                  {formatDuration(activity.durationSeconds)}
                </>
              }
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  )
}
