import { createTheme } from '@mui/material/styles';

// Admin UI theme (independent of the restaurant menu theme, which lives in the DB).
export const buildTheme = (mode: 'light' | 'dark') =>
  createTheme({
    palette: {
      mode,
      primary: { main: '#D99A19', contrastText: '#080808' },
      secondary: { main: '#C91420' },
      background:
        mode === 'dark' ? { default: '#0d0c0a', paper: '#17130F' } : { default: '#f6f4ef', paper: '#ffffff' },
    },
    shape: { borderRadius: 10 },
    typography: { fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif' },
  });
