import { accessToken } from './auth';
export const apiBase = import.meta.env.VITE_API_URL;
export const wsBase = import.meta.env.VITE_WS_URL;
if (!apiBase || !wsBase) throw new Error('TipRelay API endpoints are not configured.');
export async function api<T = any>(
  path: string,
  method = 'GET',
  body?: unknown,
  token = accessToken() || '',
): Promise<T> {
  const response = await fetch(apiBase + path, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (response.status === 401 && token && /^\/v1\/(dashboard|account|admin)(\/|$)/.test(path)) {
    sessionStorage.removeItem('access_token');
    location.replace('/');
  }
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}
export const inr = (paise: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(paise / 100);
