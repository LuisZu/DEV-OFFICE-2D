import { AppBar, Toolbar, Typography, Box, Button, Chip } from '@mui/material'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useOfficeStore } from '../stores/office.store'

const CONNECTION_LABEL: Record<
  string,
  { label: string; color: 'success' | 'warning' | 'default' }
> = {
  connected: { label: 'Conectado', color: 'success' },
  connecting: { label: 'Conectando…', color: 'warning' },
  disconnected: { label: 'Desconectado', color: 'default' },
}

const navLinkStyle = ({ isActive }: { isActive: boolean }) => ({
  color: 'inherit',
  textDecoration: 'none',
  fontWeight: isActive ? 700 : 400,
  opacity: isActive ? 1 : 0.7,
})

export function MainLayout() {
  const { user, logout } = useAuth()
  const connectionStatus = useOfficeStore((state) => state.connectionStatus)
  const connectionMeta = CONNECTION_LABEL[connectionStatus]

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="sticky"
        sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            DevOffice
          </Typography>
          <Chip
            size="small"
            label={connectionMeta.label}
            color={connectionMeta.color}
            variant="outlined"
          />
          <Box sx={{ display: 'flex', gap: 2, ml: 2 }}>
            <NavLink to="/" style={navLinkStyle} end>
              Oficina
            </NavLink>
            <NavLink to="/dashboard" style={navLinkStyle}>
              Dashboard
            </NavLink>
            <NavLink to="/activities" style={navLinkStyle}>
              Historial
            </NavLink>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          {user && (
            <Typography variant="body2" color="text.secondary">
              {user.firstName} {user.lastName}
            </Typography>
          )}
          <Button size="small" onClick={() => void logout()}>
            Cerrar sesión
          </Button>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ p: { xs: 2, md: 3 } }}>
        <Outlet />
      </Box>
    </Box>
  )
}
