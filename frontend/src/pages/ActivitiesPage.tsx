import { useState } from 'react'
import {
  Box,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useActivitiesHistory, type ActivitiesFilters } from '../features/activities/hooks/useActivitiesHistory'
import { useStatuses } from '../features/statuses/hooks/useStatuses'
import { useDevelopers } from '../features/developers/hooks/useDevelopers'
import { useProjects } from '../features/projects/hooks/useProjects'

const LIMIT = 20

function formatDuration(seconds: number | null): string {
  if (seconds === null) return 'en curso'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

export function ActivitiesPage() {
  const [filters, setFilters] = useState<Omit<ActivitiesFilters, 'page' | 'limit'>>({})
  const [page, setPage] = useState(1)

  const { data: statuses } = useStatuses()
  const { data: developers } = useDevelopers()
  const { data: projects } = useProjects()
  const { data, isLoading } = useActivitiesHistory({ ...filters, page, limit: LIMIT })

  function updateFilter<K extends keyof typeof filters>(key: K, value: string) {
    setPage(1)
    setFilters((prev) => ({ ...prev, [key]: value || undefined }))
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        Historial de actividades
      </Typography>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
          <TextField
            select
            size="small"
            label="Developer"
            value={filters.developerId ?? ''}
            onChange={(e) => updateFilter('developerId', e.target.value)}
          >
            <MenuItem value="">Todos</MenuItem>
            {developers?.map((developer) => (
              <MenuItem key={developer.id} value={developer.id}>
                {developer.firstName} {developer.lastName}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Estado"
            value={filters.statusId ?? ''}
            onChange={(e) => updateFilter('statusId', e.target.value)}
          >
            <MenuItem value="">Todos</MenuItem>
            {statuses?.map((status) => (
              <MenuItem key={status.id} value={status.id}>
                {status.icon} {status.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            size="small"
            label="Proyecto"
            value={filters.projectId ?? ''}
            onChange={(e) => updateFilter('projectId', e.target.value)}
          >
            <MenuItem value="">Todos</MenuItem>
            {projects?.map((project) => (
              <MenuItem key={project.id} value={project.id}>
                {project.code} — {project.name}
              </MenuItem>
            ))}
          </TextField>

          <Box />

          <TextField
            type="date"
            size="small"
            label="Desde"
            slotProps={{ inputLabel: { shrink: true } }}
            value={filters.dateFrom ?? ''}
            onChange={(e) => updateFilter('dateFrom', e.target.value)}
          />
          <TextField
            type="date"
            size="small"
            label="Hasta"
            slotProps={{ inputLabel: { shrink: true } }}
            value={filters.dateTo ?? ''}
            onChange={(e) => updateFilter('dateTo', e.target.value)}
          />
        </Box>
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Developer</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Tarea</TableCell>
              <TableCell>Inicio</TableCell>
              <TableCell>Fin</TableCell>
              <TableCell align="right">Duración</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!isLoading && data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    Sin resultados para estos filtros.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {data?.items.map((activity) => (
              <TableRow key={activity.id}>
                <TableCell>
                  {activity.developer.user.firstName} {activity.developer.user.lastName}
                </TableCell>
                <TableCell>
                  {activity.status.icon} {activity.status.name}
                </TableCell>
                <TableCell>{activity.task ? `${activity.task.code} — ${activity.task.title}` : '—'}</TableCell>
                <TableCell>{new Date(activity.startedAt).toLocaleString()}</TableCell>
                <TableCell>{activity.endedAt ? new Date(activity.endedAt).toLocaleString() : '—'}</TableCell>
                <TableCell align="right">{formatDuration(activity.durationSeconds)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {data && data.meta.totalPages > 1 && (
        <Pagination
          count={data.meta.totalPages}
          page={page}
          onChange={(_, value) => setPage(value)}
          sx={{ alignSelf: 'center' }}
        />
      )}
    </Stack>
  )
}
