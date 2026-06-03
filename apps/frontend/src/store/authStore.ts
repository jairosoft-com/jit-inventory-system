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
    description: string | null;
  };
  permissions?: Array<string | { name?: string }>;
}

interface AuthState {
  accessToken: string | null;
  user: User | null;
  isLoading: boolean;
  authCheckStatus: number | null;
  setAuth: (accessToken: string | null, user: User | null) => void;
  setAccessToken: (accessToken: string | null) => void;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  logoutStateOnly: () => void;
  checkAuth: () => Promise<void>;
}

let isCheckingAuth = false;
let lastAuthCheckStartedAt = 0;

const RATE_LIMIT_STATUS = 429;
const AUTH_CHECK_RATE_LIMIT_COOLDOWN_MS = 10_000;
const AUTH_USER_STORAGE_KEY = 'jit-auth-user';

function loadCachedUser() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const cachedUser = window.sessionStorage.getItem(AUTH_USER_STORAGE_KEY);

    if (!cachedUser) {
      return null;
    }

    return JSON.parse(cachedUser) as User;
  } catch {
    return null;
  }
}

function saveCachedUser(user: User | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (!user) {
    window.sessionStorage.removeItem(AUTH_USER_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: loadCachedUser(),
  isLoading: true,
  authCheckStatus: null,

  setAuth: (accessToken, user) => {
    saveCachedUser(user);
    set({ accessToken, user, authCheckStatus: null });
  },

  setAccessToken: (accessToken) => {
    set({ accessToken });
  },

  login: async (email, password) => {
    set({ isLoading: true, authCheckStatus: null });

    try {
      const response = await api.post('/auth/login', { email, password });
      const { accessToken, user } = response.data as {
        accessToken: string;
        user: User;
      };

      saveCachedUser(user);

      set({
        accessToken,
        user,
        isLoading: false,
        authCheckStatus: null,
      });

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
    } catch (error) {
      console.error('Logout API request failed:', error);
    } finally {
      get().logoutStateOnly();
    }
  },

  logoutStateOnly: () => {
    saveCachedUser(null);

    set({
      accessToken: null,
      user: null,
      isLoading: false,
      authCheckStatus: null,
    });
  },

  checkAuth: async () => {
    if (isCheckingAuth) {
      return;
    }

    const now = Date.now();
    const currentStatus = get().authCheckStatus;

    if (
      currentStatus === RATE_LIMIT_STATUS &&
      now - lastAuthCheckStartedAt < AUTH_CHECK_RATE_LIMIT_COOLDOWN_MS
    ) {
      set({ isLoading: false });
      return;
    }

    isCheckingAuth = true;
    lastAuthCheckStartedAt = now;
    set({ isLoading: true, authCheckStatus: null });

    try {
      const response = await api.get('/auth/me');
      const { user } = response.data as { user: User };

      saveCachedUser(user);

      set({
        user,
        isLoading: false,
        authCheckStatus: null,
      });
    } catch (error: unknown) {
      const err = error as { response?: { status?: number }; message?: string };
      const status = err.response?.status ?? null;

      if (status === 401) {
        saveCachedUser(null);

        set({
          accessToken: null,
          user: null,
          isLoading: false,
          authCheckStatus: 401,
        });
        return;
      }

      const cachedUser = loadCachedUser();

      set({
        user: cachedUser,
        isLoading: false,
        authCheckStatus: status,
      });
    } finally {
      isCheckingAuth = false;
    }
  },
}));

authActions.getToken = () => useAuthStore.getState().accessToken;

authActions.setAuth = (token, user) => {
  useAuthStore.getState().setAuth(token, user as User | null);
};

authActions.logoutStateOnly = () => {
  useAuthStore.getState().logoutStateOnly();
};