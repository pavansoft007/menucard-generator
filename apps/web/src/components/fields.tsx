import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { FormControlLabel, MenuItem, Switch, TextField, type TextFieldProps } from '@mui/material';

type Common<T extends FieldValues> = { control: Control<T>; name: Path<T>; label: string; helper?: string };
const err = (e: unknown): string | undefined => (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : undefined);

/** Number input; empty string maps to null when `nullable`, otherwise it stays empty (and fails validation). */
export function NumberField<T extends FieldValues>({ control, name, label, helper, min, max, step = 1, nullable, size = 'small', ...rest }: Common<T> & { min?: number; max?: number; step?: number; nullable?: boolean } & Pick<TextFieldProps, 'size'>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          {...rest}
          size={size}
          type="number"
          label={label}
          value={field.value ?? ''}
          onChange={(e) => field.onChange(e.target.value === '' ? (nullable ? null : '') : Number(e.target.value))}
          onBlur={field.onBlur}
          error={!!fieldState.error}
          helperText={err(fieldState.error) ?? helper}
          slotProps={{ htmlInput: { min, max, step }, inputLabel: { shrink: true } }}
        />
      )}
    />
  );
}

/** Colour picker + hex text box kept in sync. `nullable` adds a "none" state. */
export function ColorField<T extends FieldValues>({ control, name, label, helper, nullable }: Common<T> & { nullable?: boolean }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const v = (field.value as string | null) ?? '';
        const swatch = /^#[0-9a-fA-F]{6}$/.test(v) ? v : '#000000';
        return (
          <TextField
            size="small"
            label={label}
            value={v}
            onChange={(e) => field.onChange(e.target.value === '' && nullable ? null : e.target.value)}
            onBlur={field.onBlur}
            error={!!fieldState.error}
            helperText={err(fieldState.error) ?? helper}
            placeholder={nullable ? 'none' : '#000000'}
            slotProps={{
              inputLabel: { shrink: true },
              input: {
                startAdornment: (
                  <input
                    type="color"
                    aria-label={`${label} picker`}
                    value={swatch}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    style={{ width: 28, height: 28, border: 0, padding: 0, marginRight: 8, background: 'none', cursor: 'pointer' }}
                  />
                ),
              },
            }}
          />
        );
      }}
    />
  );
}

export function SelectField<T extends FieldValues>({ control, name, label, helper, options }: Common<T> & { options: readonly (string | { value: string; label: string })[] }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField select size="small" label={label} value={field.value ?? ''} onChange={field.onChange} error={!!fieldState.error} helperText={err(fieldState.error) ?? helper} slotProps={{ inputLabel: { shrink: true } }}>
          {options.map((o) => {
            const opt = typeof o === 'string' ? { value: o, label: o } : o;
            return (
              <MenuItem key={opt.value} value={opt.value} sx={{ textTransform: 'capitalize' }}>
                {opt.label}
              </MenuItem>
            );
          })}
        </TextField>
      )}
    />
  );
}

export function SwitchField<T extends FieldValues>({ control, name, label }: Omit<Common<T>, 'helper'>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => <FormControlLabel control={<Switch size="small" checked={!!field.value} onChange={(e) => field.onChange(e.target.checked)} />} label={label} />}
    />
  );
}
