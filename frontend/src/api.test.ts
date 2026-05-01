import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('authHeaders', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns content-type only when no API key is set', async () => {
    vi.stubEnv('VITE_GENESIS_API_KEY', '');
    const { authHeaders } = await import('./api');
    expect(authHeaders('POST')).toEqual({ 'Content-Type': 'application/json' });
  });

  it('omits the API key on GET even when set', async () => {
    vi.stubEnv('VITE_GENESIS_API_KEY', 'secret-key');
    const { authHeaders } = await import('./api');
    expect(authHeaders('GET')).toEqual({ 'Content-Type': 'application/json' });
  });

  it('includes the API key on POST when set', async () => {
    vi.stubEnv('VITE_GENESIS_API_KEY', 'secret-key');
    const { authHeaders } = await import('./api');
    expect(authHeaders('POST')).toEqual({
      'Content-Type': 'application/json',
      'X-API-Key': 'secret-key',
    });
  });

  it('includes the API key on DELETE when set', async () => {
    vi.stubEnv('VITE_GENESIS_API_KEY', 'secret-key');
    const { authHeaders } = await import('./api');
    expect(authHeaders('DELETE')).toEqual({
      'Content-Type': 'application/json',
      'X-API-Key': 'secret-key',
    });
  });
});

describe('fetchJson', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_GENESIS_API_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns parsed JSON on 2xx', async () => {
    const { fetchJson } = await import('./api');
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hello: 'world' }),
    });
    vi.stubGlobal('fetch', fakeFetch);
    const out = await fetchJson<{ hello: string }>('/api/foo');
    expect(out).toEqual({ hello: 'world' });
    expect(fakeFetch).toHaveBeenCalledWith('/api/foo', expect.objectContaining({ credentials: 'same-origin' }));
  });

  it('throws with the status code on non-2xx', async () => {
    const { fetchJson } = await import('./api');
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fakeFetch);
    await expect(fetchJson('/api/down')).rejects.toThrow('API error: 503');
  });
});
