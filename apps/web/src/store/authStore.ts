import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserDTO } from '@gc/shared-types';

interface AuthState {
  token: string | null;
  user: UserDTO | null;
  setSession: (token: string, user: UserDTO) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      clear: () => set({ token: null, user: null }),
    }),
    { name: 'gc-auth' },
  ),
);
