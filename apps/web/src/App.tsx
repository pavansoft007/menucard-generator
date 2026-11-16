import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Alert, CssBaseline, Snackbar, ThemeProvider } from '@mui/material';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { buildTheme } from './theme';
import { useUiStore } from './store/uiStore';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/layout/AdminLayout';
import LoginPage from './features/auth/LoginPage';
import DashboardPage from './features/dashboard/DashboardPage';
import ComingSoonPage from './features/common/ComingSoonPage';
import RestaurantPage from './features/restaurant/RestaurantPage';
import LogosPage from './features/logos/LogosPage';
import CategoriesPage from './features/categories/CategoriesPage';
import ItemsPage from './features/items/ItemsPage';
import MediaPage from './features/media/MediaPage';
import ThemesPage from './features/themes/ThemesPage';
import BackgroundsPage from './features/backgrounds/BackgroundsPage';
import CombosPage from './features/combos/CombosPage';
import PagesPage from './features/pages/PagesPage';
import SectionsPage from './features/sections/SectionsPage';
import PreviewPage from './features/preview/PreviewPage';
import EditorPage from './editor/EditorPage';
import TemplatesPage from './features/templates/TemplatesPage';

// Any successful save tells the other open tabs (e.g. the live preview) to refetch.
const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('gc-menu');
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
  mutationCache: new MutationCache({ onSuccess: () => channel?.postMessage('changed') }),
});

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
          <Routes>
            <Route path="/login" element={<LoginPage />} />
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
                <Route path="*" element={<ComingSoonPage />} />
              </Route>
            </Route>
          </Routes>
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
