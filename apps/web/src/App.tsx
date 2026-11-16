import { lazy, Suspense, useEffect, useMemo } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Alert, Box, CircularProgress, CssBaseline, Snackbar, ThemeProvider } from '@mui/material';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { buildTheme } from './theme';
import { useUiStore } from './store/uiStore';
import { useAuthStore } from './store/authStore';
import ProtectedRoute, { RequireAdmin } from './components/ProtectedRoute';
import AdminLayout from './components/layout/AdminLayout';
import LoginPage from './features/auth/LoginPage';
import DashboardPage from './features/dashboard/DashboardPage';
import ComingSoonPage from './features/common/ComingSoonPage';

// Everything except sign-in, the shell and the dashboard is loaded on demand, so the first screen stays small
// and the heavy pieces (visual editor, renderer, export) are only downloaded when they are opened.
const RestaurantPage = lazy(() => import('./features/restaurant/RestaurantPage'));
const LogosPage = lazy(() => import('./features/logos/LogosPage'));
const CategoriesPage = lazy(() => import('./features/categories/CategoriesPage'));
const ItemsPage = lazy(() => import('./features/items/ItemsPage'));
const MediaPage = lazy(() => import('./features/media/MediaPage'));
const ThemesPage = lazy(() => import('./features/themes/ThemesPage'));
const BackgroundsPage = lazy(() => import('./features/backgrounds/BackgroundsPage'));
const CombosPage = lazy(() => import('./features/combos/CombosPage'));
const PagesPage = lazy(() => import('./features/pages/PagesPage'));
const SectionsPage = lazy(() => import('./features/sections/SectionsPage'));
const PreviewPage = lazy(() => import('./features/preview/PreviewPage'));
const TemplatesPage = lazy(() => import('./features/templates/TemplatesPage'));
const ExportPage = lazy(() => import('./features/export/ExportPage'));
const UsersPage = lazy(() => import('./features/users/UsersPage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));
const EditorPage = lazy(() => import('./editor/EditorPage'));
const RenderPage = lazy(() => import('./features/render/RenderPage'));

// Any successful save tells the other open tabs (e.g. the live preview) to refetch.
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('gc-menu');
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
  mutationCache: new MutationCache({ onSuccess: () => channel?.postMessage('changed') }),
});

// Signing out (or having the session ended) must not leave the previous user's data in memory.
useAuthStore.subscribe((s, prev) => {
  if (prev.token && !s.token) queryClient.clear();
});

const Loading = () => (
  <Box className="flex items-center justify-center" sx={{ minHeight: 240 }} role="status" aria-label="Loading">
    <CircularProgress size={28} />
  </Box>
);

export default function App() {
  const mode = useUiStore((s) => s.mode);
  const toast = useUiStore((s) => s.toast);
  const closeToast = useUiStore((s) => s.closeToast);
  const theme = useMemo(() => buildTheme(mode), [mode]);
  useEffect(() => {
    if (!channel) return;
    channel.onmessage = () => queryClient.invalidateQueries();
    return () => { channel.onmessage = null; };
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/render/:pageId" element={<RenderPage />} />
              <Route element={<ProtectedRoute />}>
                <Route path="editor/:pageId" element={<EditorPage />} />
                <Route element={<AdminLayout />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="restaurant" element={<RestaurantPage />} />
                  <Route path="logos" element={<LogosPage />} />
                  <Route path="categories" element={<CategoriesPage />} />
                  <Route path="items" element={<ItemsPage />} />
                  <Route path="media" element={<MediaPage />} />
                  <Route path="themes" element={<ThemesPage />} />
                  <Route path="backgrounds" element={<BackgroundsPage />} />
                  <Route path="combos" element={<CombosPage />} />
                  <Route path="pages" element={<PagesPage />} />
                  <Route path="sections" element={<SectionsPage />} />
                  <Route path="preview" element={<PreviewPage />} />
                  <Route path="templates" element={<TemplatesPage />} />
                  <Route path="export" element={<ExportPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route element={<RequireAdmin />}>
                    <Route path="users" element={<UsersPage />} />
                  </Route>
                  <Route path="*" element={<ComingSoonPage />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
      <Snackbar key={toast?.key} open={!!toast} autoHideDuration={4000} onClose={closeToast}>
        {toast ? (
          <Alert severity={toast.severity} variant="filled" onClose={closeToast}>
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </ThemeProvider>
  );
}
