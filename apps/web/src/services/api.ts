import type { ApiResponse, ApiSuccess } from '@gc/shared-types';
import { useAuthStore } from '../store/authStore';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

// Set by the chrome-free /render route: a short-lived read-only token passed in the URL (never persisted).
let renderToken: string | null = null;
export const setRenderToken = (t: string | null) => { renderToken = t; };

async function request<T>(path: string, init: RequestInit = {}): Promise<ApiSuccess<T>> {
  const token = renderToken ?? useAuthStore.getState().token;
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`/api${path}`, { ...init, headers });
  let body: ApiResponse<T> | null = null;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    /* non-JSON response */
  }

  if (!res.ok || !body || !body.success) {
    if (res.status === 401 && token && !renderToken) useAuthStore.getState().clear();
    const err = body && !body.success ? body.error : null;
    throw new ApiError(res.status, err?.code ?? 'UNKNOWN', err?.message ?? `Request failed (${res.status})`, err?.details);
  }
  return body;
}

export const api = async <T>(path: string, init?: RequestInit) => (await request<T>(path, init)).data;

export interface Page<T> {
  data: T;
  meta: { page: number; pageSize: number; total: number };
}
export const apiPage = async <T>(path: string, init?: RequestInit): Promise<Page<T>> => {
  const r = await request<T>(path, init);
  return { data: r.data, meta: r.meta ?? { page: 1, pageSize: 0, total: 0 } };
};

export const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

/** Builds "?a=1&b=2" skipping empty values. */
export const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : '';
};
