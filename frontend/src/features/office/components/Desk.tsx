import { Paper } from '@mui/material'
import type { ReactNode } from 'react'

export function Desk({ children }: { children: ReactNode }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1,
        display: 'flex',
        justifyContent: 'center',
        borderRadius: 2,
        borderStyle: 'dashed',
        bgcolor: 'background.paper',
      }}
    >
      {children}
    </Paper>
  )
}
