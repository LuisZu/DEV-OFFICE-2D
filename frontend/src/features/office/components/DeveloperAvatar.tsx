import {
  Avatar,
  Badge,
  Box,
  ButtonBase,
  Tooltip,
  Typography,
} from '@mui/material'
import type { OfficeDeveloper } from '../../../types/office'
import { DeveloperStatusBadge } from './DeveloperStatusBadge'
import { DeveloperTooltip } from './DeveloperTooltip'

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

export function DeveloperAvatar({
  developer,
  onClick,
}: {
  developer: OfficeDeveloper
  onClick: () => void
}) {
  return (
    <Tooltip title={<DeveloperTooltip developer={developer} />} arrow>
      <ButtonBase
        onClick={onClick}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
          borderRadius: 2,
          p: 0.5,
        }}
      >
        <Badge
          overlap="circular"
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          badgeContent={
            <DeveloperStatusBadge
              status={developer.currentActivity?.status ?? null}
            />
          }
        >
          <Avatar
            src={developer.avatarUrl ?? undefined}
            sx={{ width: 48, height: 48, bgcolor: 'primary.main' }}
          >
            {initials(developer.firstName, developer.lastName)}
          </Avatar>
        </Badge>
        <Box sx={{ maxWidth: 72 }}>
          <Typography
            variant="caption"
            noWrap
            sx={{ display: 'block', textAlign: 'center' }}
          >
            {developer.firstName}
          </Typography>
        </Box>
      </ButtonBase>
    </Tooltip>
  )
}
