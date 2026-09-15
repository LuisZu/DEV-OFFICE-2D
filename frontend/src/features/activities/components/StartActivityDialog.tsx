import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material'
import { useStatuses } from '../../statuses/hooks/useStatuses'
import { useTasks } from '../../tasks/hooks/useTasks'
import { getApiErrorMessage } from '../../../services/api'

interface StartActivityDialogProps {
  open: boolean
  onClose: () => void
  onStart: (input: {
    statusId: string
    taskId?: string
    description?: string
  }) => Promise<unknown>
}

export function StartActivityDialog({
  open,
  onClose,
  onStart,
}: StartActivityDialogProps) {
  const { data: statuses } = useStatuses()
  const { data: tasks } = useTasks()

  const [statusId, setStatusId] = useState('')
  const [taskId, setTaskId] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedStatus = useMemo(
    () => statuses?.find((s) => s.id === statusId),
    [statuses, statusId],
  )
  const requiresTask = Boolean(selectedStatus?.requiresTask)

  function reset() {
    setStatusId('')
    setTaskId('')
    setDescription('')
    setError(null)
  }

  async function handleSubmit() {
    if (!statusId || (requiresTask && !taskId)) return
    setError(null)
    setIsSubmitting(true)
    try {
      await onStart({
        statusId,
        taskId: taskId || undefined,
        description: description || undefined,
      })
      reset()
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>¿Qué vas a hacer?</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            select
            label="Estado"
            value={statusId}
            onChange={(e) => setStatusId(e.target.value)}
            required
          >
            {statuses?.map((status) => (
              <MenuItem key={status.id} value={status.id}>
                {status.icon} {status.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={requiresTask ? 'Tarea (requerida)' : 'Tarea (opcional)'}
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            error={requiresTask && !taskId}
            helperText={
              requiresTask && !taskId
                ? 'Este estado requiere una tarea.'
                : undefined
            }
          >
            <MenuItem value="">Sin tarea</MenuItem>
            {tasks?.map((task) => (
              <MenuItem key={task.id} value={task.id}>
                {task.code} — {task.title}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Descripción"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={!statusId || (requiresTask && !taskId) || isSubmitting}
          onClick={() => void handleSubmit()}
        >
          Empezar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
