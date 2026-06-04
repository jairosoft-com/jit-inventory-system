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
  authRetryAfterSeconds: number | null;
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
const BACKEND_RATE_LIMIT_FALLBACK_SECONDS = 15 * 60;
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

function normalizeHeaderValue(value: unknown) {
  if (Array.isArray(value)) {
    return value[0] ? String(value[0]) : null;
  }

  if (value === undefined || value === null) {
    return null;
  }

  return String(value);
}

function getHeaderValue(headers: unknown, headerName: string) {
  if (!headers || typeof headers !== 'object') {
    return null;
  }

  const headerGetter = (headers as { get?: (name: string) => unknown }).get;

  if (typeof headerGetter === 'function') {
    const value = normalizeHeaderValue(headerGetter.call(headers, headerName));

    if (value) {
      return value;
    }
  }

  const headerRecord = headers as Record<string, unknown>;
  const directValue =
    headerRecord[headerName] ??
    headerRecord[headerName.toLowerCase()] ??
    headerRecord[headerName.toUpperCase()];

  const normalizedDirectValue = normalizeHeaderValue(directValue);

  if (normalizedDirectValue) {
    return normalizedDirectValue;
  }

  const matchingEntry = Object.entries(headerRecord).find(
    ([key]) => key.toLowerCase() === headerName.toLowerCase(),
  );

  return normalizeHeaderValue(matchingEntry?.[1]);
}

function parseSecondsOrDate(value: string | null) {
  if (!value) {
    return null;
  }

  const numericValue = Number(value);

  if (Number.isFinite(numericValue)) {
    return Math.max(Math.ceil(numericValue), 0);
  }

  const timestamp = Date.parse(value);

  if (!Number.isNaN(timestamp)) {
    return Math.max(Math.ceil((timestamp - Date.now()) / 1000), 0);
  }

  return null;
}

function normalizeResetValueToSeconds(value: number) {
  const currentEpochSeconds = Math.floor(Date.now() / 1000);

  if (value > currentEpochSeconds - 60) {
    return Math.max(value - currentEpochSeconds, 0);
  }

  return Math.max(Math.ceil(value), 0);
}

function parseRateLimitHeader(value: string | null) {
  if (!value) {
    return null;
  }

  const resetMatch = value.match(/(?:^|,)\s*reset="?(\d+)"?/i);

  if (!resetMatch) {
    return null;
  }

  return normalizeResetValueToSeconds(Number(resetMatch[1]));
}

function getRetryAfterSeconds(error: unknown) {
  const err = error as {
    response?: {
      headers?: unknown;
      status?: number;
    };
  };

  if (err.response?.status !== RATE_LIMIT_STATUS) {
    return null;
  }

  const headers = err.response.headers;

  const retryAfterSeconds = parseSecondsOrDate(getHeaderValue(headers, 'Retry-After'));

  if (retryAfterSeconds !== null) {
    return retryAfterSeconds;
  }

  const rateLimitReset = getHeaderValue(headers, 'RateLimit-Reset');
  const rateLimitResetSeconds = rateLimitReset ? Number(rateLimitReset) : Number.NaN;

  if (Number.isFinite(rateLimitResetSeconds)) {
    return normalizeResetValueToSeconds(rateLimitResetSeconds);
  }

  const rateLimitHeaderSeconds = parseRateLimitHeader(getHeaderValue(headers, 'RateLimit'));

  if (rateLimitHeaderSeconds !== null) {
    return rateLimitHeaderSeconds;
  }

  return BACKEND_RATE_LIMIT_FALLBACK_SECONDS;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: loadCachedUser(),
  isLoading: true,
  authCheckStatus: null,
  authRetryAfterSeconds: null,

  setAuth: (accessToken, user) => {
    saveCachedUser(user);
    set({ accessToken, user, authCheckStatus: null, authRetryAfterSeconds: null });
  },

  setAccessToken: (accessToken) => {
    set({ accessToken });
  },

  login: async (email, password) => {
    set({ isLoading: true, authCheckStatus: null, authRetryAfterSeconds: null });

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
        authRetryAfterSeconds: null,
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
      authRetryAfterSeconds: null,
    });
  },

  checkAuth: async () => {
    if (isCheckingAuth) {
      return;
    }

    const now = Date.now();
    const currentStatus = get().authCheckStatus;
    const retryAfterSeconds =
      get().authRetryAfterSeconds ?? BACKEND_RATE_LIMIT_FALLBACK_SECONDS;

    if (
      currentStatus === RATE_LIMIT_STATUS &&
      now - lastAuthCheckStartedAt < retryAfterSeconds * 1000
    ) {
      set({ isLoading: false });
      return;
    }

    isCheckingAuth = true;
    lastAuthCheckStartedAt = now;
    set({ isLoading: true, authCheckStatus: null, authRetryAfterSeconds: null });

    try {
      const response = await api.get('/auth/me');
      const { user } = response.data as { user: User };

      saveCachedUser(user);

      set({
        user,
        isLoading: false,
        authCheckStatus: null,
        authRetryAfterSeconds: null,
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
          authRetryAfterSeconds: null,
        });
        return;
      }

      const cachedUser = loadCachedUser();

      set({
        user: cachedUser,
        isLoading: false,
        authCheckStatus: status,
        authRetryAfterSeconds: getRetryAfterSeconds(error),
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
