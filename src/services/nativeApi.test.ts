import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const platform = vi.hoisted(() => ({ native: true }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => platform.native },
}));

describe('device API integration boundaries', () => {
  beforeEach(() => {
    vi.resetModules();
    platform.native = true;
    vi.stubEnv('VITE_API_BASE_URL', '');
    vi.stubEnv('BASE_URL', '/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sends native login to the hosted API with credentials for the HTTP bridge', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, user: { id: 'learner' } })));
    vi.stubGlobal('fetch', fetch);
    const { apiClient } = await import('./apiClient');
    await apiClient.login('learner@example.test', 'test-password');
    expect(fetch).toHaveBeenCalledWith('https://app.slovakgo.sk/api/auth/login', expect.objectContaining({
      method: 'POST', credentials: 'include', cache: 'no-store',
      body: JSON.stringify({ email: 'learner@example.test', password: 'test-password' }),
    }));
  });

  it('uses the explicitly built native API URL for staging', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://staging.example.test/api/');
    const { API_BASE_URL } = await import('./apiClient');
    expect(API_BASE_URL).toBe('https://staging.example.test/api');
  });

  it('keeps expired sessions as API errors instead of accepting their payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Session expired' }), { status: 401 })));
    const { apiClient } = await import('./apiClient');
    await expect(apiClient.syncPull(0)).rejects.toMatchObject({ status: 401, message: 'Session expired' });
  });

  it('does not create Stripe checkout sessions from the device build', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { apiClient } = await import('./apiClient');
    await expect(apiClient.createCheckoutSession()).rejects.toMatchObject({ status: 501 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('preserves relative URLs and Stripe checkout for the website', async () => {
    platform.native = false;
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ url: 'https://checkout.stripe.com/test' })));
    vi.stubGlobal('fetch', fetch);
    const { apiClient, API_BASE_URL } = await import('./apiClient');
    expect(API_BASE_URL).toBe('/api');
    await expect(apiClient.createCheckoutSession('yearly')).resolves.toMatchObject({ url: 'https://checkout.stripe.com/test' });
    expect(fetch).toHaveBeenCalledWith('/api/billing/checkout', expect.objectContaining({
      body: JSON.stringify({ planType: 'yearly', acceptTerms: true }),
    }));
  });
});
