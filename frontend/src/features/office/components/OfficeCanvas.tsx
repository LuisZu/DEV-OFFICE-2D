import { Box } from '@mui/material'
import type { OfficeDeveloper } from '../../../types/office'
import { OfficeArea } from './OfficeArea'
import { Desk } from './Desk'
import { DeveloperAvatar } from './DeveloperAvatar'

const AREA_META: Record<
  string,
  { title: string; icon: string; color: string }
> = {
  desks: { title: 'Escritorios', icon: '💻', color: '#4f46e5' },
  coffee: { title: 'Café', icon: '☕', color: '#a16207' },
  meeting: { title: 'Sala de reuniones', icon: '🗣', color: '#eab308' },
  lunch: { title: 'Almuerzo', icon: '🍔', color: '#f97316' },
  break: { title: 'Descanso', icon: '🏖', color: '#0ea5e9' },
}

const AREA_ORDER = ['desks', 'coffee', 'meeting', 'lunch', 'break']

// Areas group developers logically (spec section 25) rather than placing every
// avatar at pixel-perfect (x, y) coordinates — simpler to build and maintain,
// still visually distinguishes "who is where" without turning this into a game
// engine (spec section 46). The stored x/y coordinates remain available for a
// future drag-and-drop refinement without needing a schema change.
export function OfficeCanvas({
  developers,
  onSelectDeveloper,
}: {
  developers: OfficeDeveloper[]
  onSelectDeveloper: (developer: OfficeDeveloper) => void
}) {
  const byArea = new Map<string, OfficeDeveloper[]>()
  for (const developer of developers) {
    const area = developer.position?.area ?? 'desks'
    const key = AREA_META[area] ? area : 'desks'
    byArea.set(key, [...(byArea.get(key) ?? []), developer])
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr' },
        gap: 2,
      }}
    >
      {AREA_ORDER.map((areaKey) => {
        const meta = AREA_META[areaKey]
        const areaDevelopers = byArea.get(areaKey) ?? []
        const isDesks = areaKey === 'desks'

        return (
          <Box
            key={areaKey}
            sx={isDesks ? { gridColumn: { md: '1 / span 3' } } : undefined}
          >
            <OfficeArea
              title={meta.title}
              icon={meta.icon}
              accentColor={meta.color}
            >
              {areaDevelopers.map((developer) =>
                isDesks ? (
                  <Desk key={developer.id}>
                    <DeveloperAvatar
                      developer={developer}
                      onClick={() => onSelectDeveloper(developer)}
                    />
                  </Desk>
                ) : (
                  <DeveloperAvatar
                    key={developer.id}
                    developer={developer}
                    onClick={() => onSelectDeveloper(developer)}
                  />
                ),
              )}
            </OfficeArea>
          </Box>
        )
      })}
    </Box>
  )
}
