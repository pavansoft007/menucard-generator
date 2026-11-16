import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Severity = 'success' | 'error' | 'info' | 'warning';

interface UiState {
  mode: 'light' | 'dark';
  toggleMode: () => void;
  toast: { message: string; severity: Severity; key: number } | null;
  notify: (message: string, severity?: Severity) => void;
  closeToast: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      mode: 'dark',
      toggleMode: () => set((s) => ({ mode: s.mode === 'dark' ? 'light' : 'dark' })),
      toast: null,
      notify: (message, severity = 'success') => set({ toast: { message, severity, key: Date.now() } }),
      closeToast: () => set({ toast: null }),
    }),
    { name: 'gc-ui', partialize: (s) => ({ mode: s.mode }) },
  ),
);
