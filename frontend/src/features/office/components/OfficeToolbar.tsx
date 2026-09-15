import { Box, Button, Stack, Typography } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'

export function OfficeToolbar({
  developerCount,
  lastSync,
  onSync,
}: {
  developerCount: number
  lastSync: string | null
  onSync: () => void
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1}
      sx={{
        justifyContent: 'space-between',
        alignItems: { sm: 'center' },
        mb: 2,
      }}
    >
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Oficina
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {developerCount} {developerCount === 1 ? 'developer' : 'developers'}
          {lastSync &&
            ` · última sincronización ${new Date(lastSync).toLocaleTimeString()}`}
        </Typography>
      </Box>
      <Button
        size="small"
        startIcon={<RefreshIcon fontSize="small" />}
        onClick={onSync}
      >
        Sincronizar
      </Button>
    </Stack>
  )
}
