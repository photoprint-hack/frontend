import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';
import type { ApiErrorDetail } from '@/types/api';
import { tokenStore } from '@/lib/auth/token-store';
import { handleMockRequest, mockSessionUserId, type MockRequest } from '@/lib/mock/router';
import { MockHttpError } from '@/lib/mock/handlers';

export const API_BASE_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? 'https://backend-v8pa.onrender.com/api/v1').trim().replace(/\/+$/, '');

const mockFlag = String(import.meta.env.VITE_USE_MOCKS ?? '').toLowerCase();
export const USE_MOCKS = mockFlag === 'true' || mockFlag === '1' || API_BASE_URL === '';

const MOCK_LATENCY = Number(import.meta.env.VITE_MOCK_LATENCY ?? 220);

export class ApiError extends Error {
  status: number;
  code: string;
  fields: Record<string, string>;
  requestId: string | null;

  constructor(status: number, detail: ApiErrorDetail) {
    super(detail.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = detail.code;
    this.fields = detail.fields ?? {};
    this.requestId = detail.request_id ?? null;
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof MockHttpError) {
    return new ApiError(error.status, {
      code: error.code,
      message: error.message,
      fields: error.fields,
      request_id: `mock-${Date.now()}`,
    });
  }
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ detail?: ApiErrorDetail }>;
    const status = axiosError.response?.status ?? 0;
    const detail = axiosError.response?.data?.detail;
    if (detail && typeof detail === 'object' && 'message' in detail) {
      return new ApiError(status, detail as ApiErrorDetail);
    }
    if (status === 0) {
      return new ApiError(0, {
        code: 'NETWORK_ERROR',
        message: 'Нет соединения с сервером. Проверьте сеть и повторите запрос.',
      });
    }
    return new ApiError(status, {
      code: `HTTP_${status}`,
      message: axiosError.message || 'Не удалось выполнить запрос',
    });
  }
  return new ApiError(0, {
    code: 'UNKNOWN_ERROR',
    message: error instanceof Error ? error.message : 'Неизвестная ошибка',
  });
}

/* --------------------------------------------------------- refresh queue */

let refreshPromise: Promise<string | null> | null = null;
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        if (USE_MOCKS) {
          const id = mockSessionUserId();
          if (!id) return null;
          const response = await handleMockRequest({
            method: 'POST',
            path: '/auth/refresh',
            params: new URLSearchParams(),
            body: {},
            userId: id,
          });
          const token = (response.data as { data: { access_token: string } }).data.access_token;
          tokenStore.set(token);
          return token;
        }
        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true, timeout: 20_000, headers: { 'Content-Type': 'application/json' } },
        );
        const token = (response.data as { data: { access_token: string } }).data.access_token;
        tokenStore.set(token);
        return token;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

/* --------------------------------------------------------------- client */

const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL || undefined,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20_000,
  paramsSerializer: { indexes: null },
});

client.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    const status = error.response?.status;
    const isAuthEndpoint = original?.url === '/auth/login' || original?.url === '/auth/refresh';

    if (status === 401 && original && !original._retried && !isAuthEndpoint) {
      original._retried = true;
      const token = await refreshAccessToken();
      if (token) {
        original.headers = { ...(original.headers ?? {}), Authorization: `Bearer ${token}` };
        return client.request(original);
      }
      tokenStore.clear();
      onUnauthorized?.();
      return Promise.reject(toApiError(error));
    }

    if (status === 401 && original?._retried && !isAuthEndpoint) {
      tokenStore.clear();
      onUnauthorized?.();
    }

    return Promise.reject(toApiError(error));
  },
);

async function mockRequest<T>(
  method: string,
  path: string,
  options: { params?: Record<string, unknown>; body?: unknown } = {},
): Promise<T> {
  const params = new URLSearchParams();
  Object.entries(options.params ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });

  if (MOCK_LATENCY > 0) {
    await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY * (0.6 + Math.random() * 0.8)));
  }

  const request: MockRequest = {
    method,
    path,
    params,
    body: options.body,
    userId: tokenStore.get() ? mockSessionUserId() : null,
  };

  try {
    const response = await handleMockRequest(request);
    return response.data as T;
  } catch (error) {
    throw toApiError(error);
  }
}

export interface RequestOptions {
  params?: Record<string, unknown>;
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  timeout?: number;
}

export const http = {
  async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    if (USE_MOCKS) return mockRequest<T>('GET', path, options);
    const response = await client.get<T>(path, { params: options.params, signal: options.signal });
    return response.data;
  },
  async post<T>(path: string, options: RequestOptions = {}): Promise<T> {
    if (USE_MOCKS) return mockRequest<T>('POST', path, options);
    const response = await client.post<T>(path, options.body ?? {}, {
      params: options.params,
      signal: options.signal,
      headers: options.headers,
      timeout: options.timeout,
    });
    return response.data;
  },
  async patch<T>(path: string, options: RequestOptions = {}): Promise<T> {
    if (USE_MOCKS) return mockRequest<T>('PATCH', path, options);
    const response = await client.patch<T>(path, options.body ?? {}, {
      params: options.params,
      signal: options.signal,
      headers: options.headers,
      timeout: options.timeout,
    });
    return response.data;
  },
  async delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    if (USE_MOCKS) return mockRequest<T>('DELETE', path, options);
    const response = await client.delete<T>(path, { params: options.params, signal: options.signal });
    return response.data as T;
  },
};

/** Idempotency-Key для POST создания (UUID v4), переиспользуется при повторе. */
export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default client;
