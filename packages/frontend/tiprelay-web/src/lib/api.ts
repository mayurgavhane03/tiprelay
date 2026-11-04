import { accessToken } from './auth';
export const apiBase = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001';
export const wsBase = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:3001';
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
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}
export const inr = (paise: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(paise / 100);
