import { useEffect, useState, type ReactNode } from 'react';
import { Box, MenuItem, TextField, Typography } from '@mui/material';
import { themeColorKeys, type ColorRef, type ThemeConfig } from '@gc/shared-types';
import { themeColorLabel, resolveColor } from '../renderer/tokens';

export const Group = ({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) => (
  <Box sx={{ borderBottom: 1, borderColor: 'divider', p: 1.5 }}>
    <div className="mb-1.5 flex items-center justify-between">
      <Typography variant="overline" fontWeight={700} color="text.secondary" lineHeight={1.6}>{title}</Typography>
      {action}
    </div>
    <div className="flex flex-col gap-2">{children}</div>
  </Box>
);

export const Row = ({ children, cols = 2 }: { children: ReactNode; cols?: number }) => <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>{children}</div>;

/** Number input that keeps its own text while typing (so "1." or "-" don't fight the parent) and commits valid numbers. */
export function Num({ label, value, onChange, min, max, step = 1, suffix }: { label: string; value: number | null; onChange: (n: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  const [text, setText] = useState(value === null ? '' : String(value));
  useEffect(() => { setText((t) => (Number(t) === value ? t : value === null ? '' : String(value))); }, [value]);
  const bad = text !== '' && (Number.isNaN(Number(text)) || (min !== undefined && Number(text) < min) || (max !== undefined && Number(text) > max));
  return (
    <TextField
      size="small"
      label={label}
      value={text}
      error={bad}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value !== '' && !Number.isNaN(n) && (min === undefined || n >= min) && (max === undefined || n <= max)) onChange(n);
      }}
      slotProps={{ htmlInput: { inputMode: 'decimal', step }, input: suffix ? { endAdornment: <Typography variant="caption" color="text.secondary">{suffix}</Typography> } : undefined, inputLabel: { shrink: true } }}
    />
  );
}

export function Sel<T extends string | number>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: readonly (T | { value: T; label: string })[] }) {
  return (
    <TextField select size="small" label={label} value={value} onChange={(e) => onChange((typeof value === 'number' ? Number(e.target.value) : e.target.value) as T)} slotProps={{ inputLabel: { shrink: true } }}>
      {options.map((o) => {
        const opt = typeof o === 'object' ? o : { value: o, label: String(o) };
        return <MenuItem key={String(opt.value)} value={opt.value} sx={{ textTransform: 'capitalize' }}>{opt.label}</MenuItem>;
      })}
    </TextField>
  );
}

/** Theme colour reference or a custom hex. `nullable` adds "None". */
export function ColorRefField({ label, value, onChange, theme, nullable }: { label: string; value: ColorRef | null; onChange: (v: ColorRef | null) => void; theme: ThemeConfig; nullable?: boolean }) {
  const mode = value === null ? 'none' : value.startsWith('theme:') ? value : 'custom';
  const swatch = resolveColor(value, theme);
  return (
    <div className="flex flex-col gap-1">
      <TextField
        select
        size="small"
        label={label}
        value={mode}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === 'none' ? null : v === 'custom' ? (swatch && /^#[0-9a-f]{6}$/i.test(swatch) ? swatch : '#FFFFFF') : (v as ColorRef));
        }}
        slotProps={{ inputLabel: { shrink: true } }}
      >
        {nullable && <MenuItem value="none">None</MenuItem>}
        {themeColorKeys.map((k) => (
          <MenuItem key={k} value={`theme:${k}`}>
            <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: theme.colors[k], border: '1px solid #8886', marginRight: 8 }} />
            {themeColorLabel[k]}
          </MenuItem>
        ))}
        <MenuItem value="custom">Custom colour…</MenuItem>
      </TextField>
      {mode === 'custom' && value && (
        <div className="flex items-center gap-2">
          <input type="color" aria-label={`${label} picker`} value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'} onChange={(e) => onChange(e.target.value.toUpperCase())} style={{ width: 34, height: 30, border: 0, padding: 0, background: 'none' }} />
          <TextField size="small" value={value} onChange={(e) => /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(e.target.value) && onChange(e.target.value.toUpperCase())} slotProps={{ htmlInput: { 'aria-label': `${label} hex` } }} sx={{ flex: 1 }} />
        </div>
      )}
    </div>
  );
}
