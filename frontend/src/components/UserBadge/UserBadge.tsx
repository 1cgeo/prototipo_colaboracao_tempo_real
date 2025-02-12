import React, { useMemo } from 'react';
import { Avatar, Box, Tooltip, Typography } from '@mui/material';
import { stringToColor } from './utils';

type Size = 'small' | 'medium' | 'large';

interface UserBadgeProps {
  userId: string;
  displayName: string;
  size?: Size;
  showTooltip?: boolean;
  abbreviated?: boolean;
}

interface SizeConfig {
  avatarSize: number;
  typographyVariant: 'caption' | 'body2' | 'body1';
  spacing: number;
}

const sizeConfigs: Record<Size, SizeConfig> = {
  small: {
    avatarSize: 24,
    typographyVariant: 'caption',
    spacing: 1
  },
  medium: {
    avatarSize: 32,
    typographyVariant: 'body2',
    spacing: 1.5
  },
  large: {
    avatarSize: 40,
    typographyVariant: 'body1',
    spacing: 2
  }
};

// Utility functions moved into component file since they're only used here
function getInitials(displayName: string): string {
  return displayName
    .split(' ')
    .map(word => word[0])
    .join('');
}

function getAbbreviatedName(displayName: string): string {
  const [first, last] = displayName.split(' ');
  return `${first} ${last[0]}.`;
}

const UserBadge: React.FC<UserBadgeProps> = ({
  userId,
  displayName,
  size = 'medium',
  showTooltip = true,
  abbreviated = false,
}) => {
  // Generate consistent color based on userId
  const userColor = useMemo(() => stringToColor(userId), [userId]);

  const config = sizeConfigs[size];

  // Get initials from display name
  const initials = getInitials(displayName);

  // Abbreviated display name if needed
  const displayText = abbreviated 
    ? getAbbreviatedName(displayName)
    : displayName;

  const badge = (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: config.spacing,
        '&:hover': {
          backgroundColor: 'rgba(0, 0, 0, 0.04)',
          borderRadius: 1
        }
      }}
    >
      <Avatar
        sx={{
          width: config.avatarSize,
          height: config.avatarSize,
          bgcolor: userColor,
          fontSize: config.avatarSize * 0.5
        }}
      >
        {initials}
      </Avatar>
      <Typography
        variant={config.typographyVariant}
        sx={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          whiteSpace: 'nowrap',
          color: 'text.primary'
        }}
      >
        {displayText}
      </Typography>
    </Box>
  );

  if (showTooltip && abbreviated) {
    return (
      <Tooltip title={displayName} placement="bottom">
        {badge}
      </Tooltip>
    );
  }

  return badge;
};

export default UserBadge;