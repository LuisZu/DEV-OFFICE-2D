import { Box } from '@mui/material'
import type { ActivityStatusSummary } from '../../../types/office'

const OFFLINE_COLOR = '#9ca3af'

export function DeveloperStatusBadge({
  status,
}: {
  status: ActivityStatusSummary | null
}) {
  return (
    <Box
      sx={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        lineHeight: 1,
        bgcolor: status?.color ?? OFFLINE_COLOR,
        border: '2px solid',
        borderColor: 'background.paper',
      }}
      title={status?.name ?? 'Sin actividad'}
    >
      {status?.icon ?? '⚪'}
    </Box>
  )
}
