import { Box, Paper, Typography } from '@mui/material'
import type { ReactNode } from 'react'

interface OfficeAreaProps {
  title: string
  icon: string
  accentColor: string
  children: ReactNode
}

export function OfficeArea({
  title,
  icon,
  accentColor,
  children,
}: OfficeAreaProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        minHeight: 140,
        borderTop: '3px solid',
        borderTopColor: accentColor,
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
        }}
      >
        <span aria-hidden>{icon}</span> {title}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        {children ?? (
          <Typography variant="caption" color="text.secondary">
            Nadie aquí ahora mismo.
          </Typography>
        )}
      </Box>
    </Paper>
  )
}
