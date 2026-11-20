/**
 * Cliente HTTP del frontend. La sesión de administrador vive en cookies httpOnly
 * (el frontend nunca ve los tokens). Toda petición lleva la cabecera anti-CSRF.
 */
const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  code: string;
  fields: Record<string, string>;
  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

let refreshing: Promise<boolean> | null = null;
let onSessionExpired: (() => void) | null = null;
export const setSessionExpiredHandler = (fn: () => void) => {
  onSessionExpired = fn;
};

async function refreshSession() {
  refreshing ??= fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Requested-With': 'avolar' },
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      setTimeout(() => (refreshing = null), 0);
    });
  return refreshing;
}

type Body = Record<string, unknown> | unknown[] | FormData | undefined;

async function request<T>(method: string, path: string, body?: Body, retry = true): Promise<T> {
  const headers: Record<string, string> = { 'X-Requested-With': 'avolar' };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: payload, credentials: 'include' });
  } catch {
    throw new ApiError(0, 'NETWORK', 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.');
  }

  // Sesión admin expirada: se intenta renovar una vez de forma transparente.
  if (res.status === 401 && retry && path.startsWith('/admin')) {
    if (await refreshSession()) return request<T>(method, path, body, false);
    onSessionExpired?.();
  }

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = data?.error;
    throw new ApiError(
      res.status,
      err?.code ?? 'HTTP_' + res.status,
      err?.message ?? 'Algo salió mal. Intenta de nuevo.',
      err?.details?.fields ?? {},
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: Body) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body: Body) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: Body) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
  refresh: refreshSession,
};

/** Convierte un objeto de filtros en query string, omitiendo vacíos. */
export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : '';
}
