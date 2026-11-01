import { api } from './api.js';

export async function bootstrapAuth(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (token) {
    window.history.replaceState({}, '', window.location.pathname);
    await api.exchange(token);
  }
}
