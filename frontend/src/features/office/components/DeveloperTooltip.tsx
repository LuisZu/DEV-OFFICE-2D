import { Box, Typography } from '@mui/material'
import type { OfficeDeveloper } from '../../../types/office'

export function DeveloperTooltip({
  developer,
}: {
  developer: OfficeDeveloper
}) {
  const activity = developer.currentActivity

  return (
    <Box sx={{ py: 0.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {developer.firstName} {developer.lastName}
      </Typography>
      {activity ? (
        <>
          <Typography variant="caption" sx={{ display: 'block' }}>
            {activity.status.icon} {activity.status.name}
          </Typography>
          {activity.task && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block' }}
            >
              {activity.task.code} · {activity.task.title}
            </Typography>
          )}
        </>
      ) : (
        <Typography variant="caption" color="text.secondary">
          Sin actividad activa
        </Typography>
      )}
    </Box>
  )
}
