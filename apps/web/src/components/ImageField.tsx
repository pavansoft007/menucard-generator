import { useState } from 'react';
import { Box, Button, FormHelperText, IconButton, Tooltip, Typography } from '@mui/material';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import CloseIcon from '@mui/icons-material/Close';
import type { MediaDTO } from '@gc/shared-types';
import MediaPicker from '../features/media/MediaPicker';
import { checker } from './common';

/** Single-image chooser. The parent stores only the id; the MediaDTO is used for the preview. */
export function ImageField({
  label,
  value,
  onChange,
  size = 96,
  helperText,
}: {
  label: string;
  value: MediaDTO | null;
  onChange: (m: MediaDTO | null) => void;
  size?: number;
  helperText?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <div className="flex items-center gap-2">
        <Box
          onClick={() => setOpen(true)}
          sx={{ ...checker, width: size, height: size, borderRadius: 1.5, cursor: 'pointer', border: 1, borderColor: 'divider', flexShrink: 0 }}
          className="flex items-center justify-center overflow-hidden"
        >
          {value ? (
            <img src={value.thumbUrl} alt={value.altText ?? value.originalName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          ) : (
            <AddPhotoAlternateIcon sx={{ color: 'text.disabled' }} />
          )}
        </Box>
        <div className="flex flex-col items-start">
          <Button size="small" onClick={() => setOpen(true)}>
            {value ? 'Change' : 'Choose'}
          </Button>
          {value && (
            <Button size="small" color="inherit" onClick={() => onChange(null)}>
              Remove
            </Button>
          )}
        </div>
      </div>
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
      <MediaPicker open={open} title={`Choose ${label.toLowerCase()}`} onClose={() => setOpen(false)} onSelect={(m) => onChange(m[0] ?? null)} />
    </Box>
  );
}

/** Multi-image chooser used for item galleries. */
export function GalleryField({ label, value, onChange }: { label: string; value: MediaDTO[]; onChange: (m: MediaDTO[]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <div className="flex flex-wrap items-center gap-2">
        {value.map((m) => (
          <Box key={m.id} sx={{ ...checker, width: 72, height: 72, borderRadius: 1.5, position: 'relative', border: 1, borderColor: 'divider' }} className="flex items-center justify-center overflow-hidden">
            <img src={m.thumbUrl} alt={m.originalName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            <Tooltip title="Remove">
              <IconButton size="small" aria-label={`Remove ${m.originalName}`} onClick={() => onChange(value.filter((x) => x.id !== m.id))} sx={{ position: 'absolute', top: 0, right: 0, bgcolor: 'rgba(0,0,0,.6)', color: '#fff', p: 0.25 }}>
                <CloseIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          </Box>
        ))}
        <Button size="small" variant="outlined" startIcon={<AddPhotoAlternateIcon />} onClick={() => setOpen(true)}>
          Add images
        </Button>
      </div>
      <MediaPicker
        open={open}
        multiple
        title="Add gallery images"
        excludeIds={value.map((m) => m.id)}
        onClose={() => setOpen(false)}
        onSelect={(m) => onChange([...value, ...m])}
      />
    </Box>
  );
}
