import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

export const authActions = {
  getToken: () => null as string | null,
  setAuth: (token: string, user: unknown) => {
    void token;
    void user;
  },
  logoutStateOnly: () => {},
};

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string) || 'http://localhost:3001/api',
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    const token = authActions.getToken();

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error: unknown) => Promise.reject(error),
);

let isRefreshing = false;

let failedQueue: Array<{
  resolve: (value: string) => void;
  reject: (reason: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (token) {
      promise.resolve(token);
    } else {
      promise.reject(error);
    }
  });

  failedQueue = [];
};

function shouldLogoutFromRefreshFailure(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  const status = error.response?.status;

  return status === 401 || status === 403;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;
    const status = error.response?.status;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    if (
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/auth/login')
    ) {
      return Promise.reject(error);
    }

    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((queueError: unknown) => Promise.reject(queueError));
      }

      isRefreshing = true;

      try {
        const response = await axios.post<{ accessToken: string; user: unknown }>(
          `${api.defaults.baseURL}/auth/refresh`,
          {},
          { withCredentials: true },
        );

        const { accessToken, user } = response.data;

        authActions.setAuth(accessToken, user);
        processQueue(null, accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        return api(originalRequest);
      } catch (refreshError: unknown) {
        processQueue(refreshError, null);

        if (shouldLogoutFromRefreshFailure(refreshError)) {
          authActions.logoutStateOnly();

          if (typeof window !== 'undefined' && window.location.pathname !== '/') {
            window.location.href = '/';
          }
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
