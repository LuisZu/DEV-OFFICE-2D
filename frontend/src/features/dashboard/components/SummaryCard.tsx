import { Paper, Stack, Typography } from '@mui/material'

export function SummaryCard({
  label,
  value,
  icon,
  accentColor,
}: {
  label: string
  value: number
  icon?: string
  accentColor?: string
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        minWidth: 140,
        borderTop: '3px solid',
        borderTopColor: accentColor ?? 'divider',
      }}
    >
      <Stack spacing={0.5}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          {icon && <span aria-hidden>{icon}</span>} {label}
        </Typography>
        <Typography
          variant="h4"
          sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </Typography>
      </Stack>
    </Paper>
  )
}
