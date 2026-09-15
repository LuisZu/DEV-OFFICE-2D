import {
  Avatar,
  Box,
  Chip,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import type { OfficeDeveloper } from '../../../types/office'
import { useElapsedTime } from '../../../hooks/useElapsedTime'

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

function ElapsedSince({ startedAt }: { startedAt: string }) {
  const elapsed = useElapsedTime(startedAt)
  return (
    <Typography variant="h5" sx={{ fontVariantNumeric: 'tabular-nums' }}>
      ⏱ {elapsed}
    </Typography>
  )
}

export function DeveloperDetailsPanel({
  developer,
  onClose,
}: {
  developer: OfficeDeveloper | null
  onClose: () => void
}) {
  const activity = developer?.currentActivity

  return (
    <Drawer anchor="right" open={Boolean(developer)} onClose={onClose}>
      {developer && (
        <Box sx={{ width: 320, p: 3 }}>
          <Stack
            direction="row"
            sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
          >
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Avatar
                src={developer.avatarUrl ?? undefined}
                sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}
              >
                {initials(developer.firstName, developer.lastName)}
              </Avatar>
              <Box>
                <Typography variant="h6" sx={{ lineHeight: 1.1 }}>
                  {developer.firstName} {developer.lastName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {developer.email}
                </Typography>
              </Box>
            </Stack>
            <IconButton onClick={onClose} size="small" aria-label="Cerrar">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>

          <Box sx={{ mt: 3 }}>
            {activity ? (
              <Stack spacing={1.5}>
                <Chip
                  label={`${activity.status.icon ?? ''} ${activity.status.name}`.trim()}
                  sx={{
                    bgcolor: activity.status.color ?? undefined,
                    alignSelf: 'flex-start',
                  }}
                />
                {activity.task && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Tarea actual
                    </Typography>
                    <Typography variant="body1">
                      {activity.task.code} — {activity.task.title}
                    </Typography>
                  </Box>
                )}
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Hora de inicio
                  </Typography>
                  <Typography variant="body2">
                    {new Date(activity.startedAt).toLocaleTimeString()}
                  </Typography>
                </Box>
                <ElapsedSince startedAt={activity.startedAt} />
              </Stack>
            ) : (
              <Typography color="text.secondary">
                Sin actividad activa en este momento.
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </Drawer>
  )
}
