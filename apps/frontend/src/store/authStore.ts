import { create } from 'zustand';
import api, { authActions } from '../lib/api';

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  roleId: number;
  role: {
    id: number;
    name: string;
    description: string;
  };
}

interface AuthState {
  accessToken: string | null;
  user: User | null;
  isLoading: boolean;
  setAuth: (accessToken: string | null, user: User | null) => void;
  setAccessToken: (accessToken: string | null) => void;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  logoutStateOnly: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  isLoading: true,

  setAuth: (accessToken, user) => set({ accessToken, user }),
  setAccessToken: (accessToken) => set({ accessToken }),

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const response = await api.post('/auth/login', { email, password });
      const { accessToken, user } = response.data;
      set({ accessToken, user, isLoading: false });
      return user;
    } catch (error: unknown) {
      set({ isLoading: false });
      const err = error as { response?: { data?: { message?: string } } };
      throw new Error(err.response?.data?.message || 'Login failed');
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      console.error('Logout API request failed:', e);
    } finally {
      get().logoutStateOnly();
    }
  },

  logoutStateOnly: () => {
    set({ accessToken: null, user: null, isLoading: false });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const response = await api.get('/auth/me');
      const { user } = response.data;
      set({ user, isLoading: false });
    } catch (error: unknown) {
      // Quietly set unauthenticated state if the request returns a standard 401
      const err = error as { response?: { status?: number }; message?: string };
      if (err.response?.status !== 401) {
        console.warn('CheckAuth failed:', err.message || error);
      }
      set({ accessToken: null, user: null, isLoading: false });
    }
  },
}));

authActions.getToken = () => useAuthStore.getState().accessToken;
authActions.setAuth = (token, user) => useAuthStore.getState().setAuth(token, user as User | null);
authActions.logoutStateOnly = () => useAuthStore.getState().logoutStateOnly();

