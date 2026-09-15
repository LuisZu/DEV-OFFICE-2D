import { Box, Paper, Tooltip, Typography } from '@mui/material'
import type { ActivityDistributionEntry } from '../hooks/useDashboard'

function formatDuration(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `${hours} h ${minutes % 60} min`
}

const FALLBACK_COLOR = '#9ca3af'

// Horizontal bar chart: the data's job here is comparing a single magnitude
// (time spent) across ~10 categories (statuses) — a bar chart reads that
// directly, a pie/donut would not (too many slices, angle is harder to compare
// than length). Bars use each status's own color (the same one used everywhere
// else in the app for that status — badges, chips), so color still tracks
// identity consistently; every bar is also direct-labeled with the status name
// and a duration value in text-token ink, so nothing depends on color alone.
export function ActivityDistributionChart({
  entries,
}: {
  entries: ActivityDistributionEntry[]
}) {
  if (entries.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography color="text.secondary">
          Sin datos en el rango seleccionado (últimos 7 días).
        </Typography>
      </Paper>
    )
  }

  const sorted = [...entries].sort((a, b) => b.totalSeconds - a.totalSeconds)
  const max = Math.max(...sorted.map((entry) => entry.totalSeconds), 1)

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {sorted.map((entry) => {
          const widthPct = Math.max(2, (entry.totalSeconds / max) * 100)
          return (
            <Tooltip
              key={entry.status.id}
              title={`${entry.status.name}: ${formatDuration(entry.totalSeconds)} · ${entry.count} actividad(es)`}
              arrow
              placement="top"
            >
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr 72px',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Typography variant="body2" noWrap>
                  {entry.status.name}
                </Typography>
                <Box
                  sx={{
                    bgcolor: 'action.hover',
                    borderRadius: 999,
                    height: 12,
                    position: 'relative',
                  }}
                >
                  <Box
                    sx={{
                      width: `${widthPct}%`,
                      height: '100%',
                      borderRadius: 999,
                      bgcolor: entry.status.color ?? FALLBACK_COLOR,
                    }}
                  />
                </Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ textAlign: 'right' }}
                >
                  {formatDuration(entry.totalSeconds)}
                </Typography>
              </Box>
            </Tooltip>
          )
        })}
      </Box>
    </Paper>
  )
}
