import { useState } from 'react'
import {
  Alert,
  Button,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material'
import {
  useCurrentActivity,
  useActivityMutations,
} from '../hooks/useCurrentActivity'
import { useStatuses } from '../../statuses/hooks/useStatuses'
import { useTasks } from '../../tasks/hooks/useTasks'
import { useElapsedTime } from '../../../hooks/useElapsedTime'
import { getApiErrorMessage } from '../../../services/api'
import { useAuthStore } from '../../../stores/auth.store'
import { UserRole } from '../../../types/auth'
import { StartActivityDialog } from './StartActivityDialog'

export function CurrentActivityCard() {
  const isDeveloper = useAuthStore(
    (state) => state.user?.roles.includes(UserRole.DEVELOPER) ?? false,
  )
  const { data: activity, isLoading } = useCurrentActivity()
  const { data: statuses } = useStatuses()
  const { data: tasks } = useTasks()
  const { start, finish, changeStatus, changeTask } = useActivityMutations()

  const [startOpen, setStartOpen] = useState(false)
  const [statusMenuAnchor, setStatusMenuAnchor] = useState<HTMLElement | null>(
    null,
  )
  const [taskMenuAnchor, setTaskMenuAnchor] = useState<HTMLElement | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)

  const elapsed = useElapsedTime(
    activity?.startedAt ?? new Date().toISOString(),
  )

  // Only developer accounts have an "own activity" to show at all — ADMIN/
  // MANAGER/VIEWER see the office/dashboard views without this card.
  if (!isDeveloper) {
    return null
  }

  if (isLoading) {
    return <Skeleton variant="rounded" height={140} />
  }

  if (!activity) {
    return (
      <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary" sx={{ mb: 1.5 }}>
          No tienes una actividad activa ahora mismo.
        </Typography>
        <Button variant="contained" onClick={() => setStartOpen(true)}>
          Empezar a trabajar
        </Button>
        <StartActivityDialog
          open={startOpen}
          onClose={() => setStartOpen(false)}
          onStart={(input) => start.mutateAsync(input)}
        />
      </Paper>
    )
  }

  async function handleFinish() {
    setError(null)
    try {
      await finish.mutateAsync({ activityId: activity!.id })
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }

  async function handleChangeStatus(statusId: string) {
    setStatusMenuAnchor(null)
    setError(null)
    try {
      await changeStatus.mutateAsync({ statusId })
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }

  async function handleChangeTask(taskId: string | null) {
    setTaskMenuAnchor(null)
    setError(null)
    try {
      await changeTask.mutateAsync(taskId)
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Stack spacing={1}>
        <Typography variant="overline" color="text.secondary">
          Tu actividad actual
        </Typography>
        <Typography variant="h6">
          {activity.status.icon} {activity.status.name}
        </Typography>
        {activity.task && (
          <Typography variant="body2" color="text.secondary">
            {activity.task.code} — {activity.task.title}
          </Typography>
        )}
        <Typography
          variant="h4"
          sx={{ fontVariantNumeric: 'tabular-nums', my: 1 }}
        >
          ⏱ {elapsed}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <Button
            size="small"
            onClick={(e) => setStatusMenuAnchor(e.currentTarget)}
          >
            Cambiar estado
          </Button>
          <Button
            size="small"
            onClick={(e) => setTaskMenuAnchor(e.currentTarget)}
          >
            Cambiar tarea
          </Button>
          <Button
            size="small"
            color="error"
            onClick={() => void handleFinish()}
          >
            Finalizar
          </Button>
        </Stack>
      </Stack>

      <Menu
        anchorEl={statusMenuAnchor}
        open={Boolean(statusMenuAnchor)}
        onClose={() => setStatusMenuAnchor(null)}
      >
        {statuses
          ?.filter((status) => !status.requiresTask)
          .map((status) => (
            <MenuItem
              key={status.id}
              onClick={() => void handleChangeStatus(status.id)}
            >
              {status.icon} {status.name}
            </MenuItem>
          ))}
      </Menu>

      <Menu
        anchorEl={taskMenuAnchor}
        open={Boolean(taskMenuAnchor)}
        onClose={() => setTaskMenuAnchor(null)}
      >
        <MenuItem onClick={() => void handleChangeTask(null)}>
          Sin tarea
        </MenuItem>
        {tasks?.map((task) => (
          <MenuItem key={task.id} onClick={() => void handleChangeTask(task.id)}>
            {task.code} — {task.title}
          </MenuItem>
        ))}
      </Menu>
    </Paper>
  )
}
