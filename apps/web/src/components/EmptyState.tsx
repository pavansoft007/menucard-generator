import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import InboxIcon from '@mui/icons-material/Inbox';

export default function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <Box className="flex flex-col items-center gap-2 py-16 text-center">
      <InboxIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
      <Typography variant="h6">{title}</Typography>
      {description && (
        <Typography color="text.secondary" maxWidth={440}>
          {description}
        </Typography>
      )}
      {action}
    </Box>
  );
}
