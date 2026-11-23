import { beforeEach, expect, it, vi } from 'vitest';
beforeEach(() => { vi.resetModules();sessionStorage.clear(); });
it('Axios attaches the JWT and omits it from explicit public requests', async () => {
  const client = await import('../api');
  client.setAuthSession({ accessToken: 'test-bearer', user: { id: 2 } });
  const seen = [];
  client.http.defaults.adapter = async config => { seen.push(config);return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config }; };
  await client.api('/profile');await client.api('/auth/config', { skipAuth: true });
  expect(seen[0].headers.Authorization).toBe('Bearer test-bearer');expect(seen[1].headers.Authorization).toBeUndefined();
  expect(sessionStorage.getItem('rentora.accessToken')).toBe('test-bearer');
});
it('Axios clears a rejected JWT and notifies the application', async () => {
  const client = await import('../api');client.setAuthSession({ accessToken: 'expired', user: { id: 2 } });
  const listener = vi.fn();window.addEventListener('rentora:unauthorized', listener);
  client.http.defaults.adapter = async config => { const error = new Error('Unauthorized');error.config = config;error.response = { status: 401, data: { message: 'Expired token' } };throw error; };
  await expect(client.api('/profile')).rejects.toThrow('Expired token');
  expect(client.hasAuthToken()).toBe(false);expect(listener).toHaveBeenCalledOnce();window.removeEventListener('rentora:unauthorized', listener);
});
