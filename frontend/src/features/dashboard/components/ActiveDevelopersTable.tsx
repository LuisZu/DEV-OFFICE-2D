import {
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import type { OfficeDeveloper } from '../../../types/office'
import { useElapsedTime } from '../../../hooks/useElapsedTime'

function ElapsedCell({ startedAt }: { startedAt: string }) {
  const elapsed = useElapsedTime(startedAt)
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{elapsed}</span>
}

export function ActiveDevelopersTable({
  developers,
}: {
  developers: OfficeDeveloper[]
}) {
  if (developers.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography color="text.secondary">
          Nadie tiene una actividad activa ahora mismo.
        </Typography>
      </Paper>
    )
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Developer</TableCell>
            <TableCell>Estado</TableCell>
            <TableCell>Tarea</TableCell>
            <TableCell align="right">Tiempo</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {developers.map((developer) => (
            <TableRow key={developer.id}>
              <TableCell>
                {developer.firstName} {developer.lastName}
              </TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={`${developer.currentActivity?.status.icon ?? ''} ${developer.currentActivity?.status.name ?? ''}`.trim()}
                  sx={{
                    bgcolor:
                      developer.currentActivity?.status.color ?? undefined,
                  }}
                />
              </TableCell>
              <TableCell>
                {developer.currentActivity?.task ? (
                  <Typography variant="body2">
                    {developer.currentActivity.task.code} —{' '}
                    {developer.currentActivity.task.title}
                  </Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    —
                  </Typography>
                )}
              </TableCell>
              <TableCell align="right">
                {developer.currentActivity && (
                  <ElapsedCell
                    startedAt={developer.currentActivity.startedAt}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
