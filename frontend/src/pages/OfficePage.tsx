import { useState } from 'react'
import { Box, Stack } from '@mui/material'
import { useOfficeSocket } from '../features/office/hooks/useOfficeSocket'
import { useOfficeStore } from '../stores/office.store'
import { OfficeToolbar } from '../features/office/components/OfficeToolbar'
import { OfficeCanvas } from '../features/office/components/OfficeCanvas'
import { DeveloperDetailsPanel } from '../features/office/components/DeveloperDetailsPanel'
import { CurrentActivityCard } from '../features/activities/components/CurrentActivityCard'
import type { OfficeDeveloper } from '../types/office'

export function OfficePage() {
  const { requestSync } = useOfficeSocket()
  const developers = useOfficeStore((state) => state.developers)
  const lastSync = useOfficeStore((state) => state.lastSync)
  const [selectedDeveloper, setSelectedDeveloper] =
    useState<OfficeDeveloper | null>(null)

  const developerList = Object.values(developers)

  return (
    <Stack spacing={3} sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ maxWidth: 360 }}>
        <CurrentActivityCard />
      </Box>

      <Box>
        <OfficeToolbar
          developerCount={developerList.length}
          lastSync={lastSync}
          onSync={requestSync}
        />
        <OfficeCanvas
          developers={developerList}
          onSelectDeveloper={setSelectedDeveloper}
        />
      </Box>

      <DeveloperDetailsPanel
        developer={selectedDeveloper}
        onClose={() => setSelectedDeveloper(null)}
      />
    </Stack>
  )
}
