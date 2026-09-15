import { Box, Stack, Typography } from '@mui/material'
import {
  useActiveActivities,
  useActivityDistribution,
  useDashboardSummary,
} from '../features/dashboard/hooks/useDashboard'
import { useRecentActivities } from '../features/dashboard/hooks/useRecentActivities'
import { SummaryCard } from '../features/dashboard/components/SummaryCard'
import { ActiveDevelopersTable } from '../features/dashboard/components/ActiveDevelopersTable'
import { ActivityDistributionChart } from '../features/dashboard/components/ActivityDistributionChart'
import { RecentActivities } from '../features/dashboard/components/RecentActivities'

export function DashboardPage() {
  const { data: summary } = useDashboardSummary()
  const { data: activeDevelopers } = useActiveActivities()
  const { data: distribution } = useActivityDistribution()
  const { data: recentActivities } = useRecentActivities()

  return (
    <Stack spacing={3} sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        Dashboard
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <SummaryCard
          label="Developers"
          value={summary?.totalDevelopers ?? 0}
          icon="👥"
          accentColor="#4f46e5"
        />
        {summary?.byStatus.map((status) => (
          <SummaryCard
            key={status.id}
            label={status.name}
            value={status.count}
            icon={status.icon ?? undefined}
            accentColor={status.color ?? undefined}
          />
        ))}
        <SummaryCard
          label="Sin actividad"
          value={summary?.withoutActivity ?? 0}
          icon="⚪"
          accentColor="#9ca3af"
        />
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
          Actividades en curso
        </Typography>
        <ActiveDevelopersTable developers={activeDevelopers ?? []} />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 3,
        }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Distribución de tiempo (últimos 7 días)
          </Typography>
          <ActivityDistributionChart entries={distribution ?? []} />
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Actividad reciente
          </Typography>
          <RecentActivities activities={recentActivities ?? []} />
        </Box>
      </Box>
    </Stack>
  )
}
