import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
  getProducts: vi.fn(),
  purchase: vi.fn(),
  restore: vi.fn(),
  finish: vi.fn().mockResolvedValue(undefined),
  manageSubscriptions: vi.fn(),
  requestReview: vi.fn().mockResolvedValue(undefined),
  addListener: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: () => store,
}));
const api = vi.hoisted(() => ({ appleAccount: vi.fn(), submitAppleTransactions: vi.fn() }));
vi.mock('./apiClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./apiClient')>()),
  apiClient: api,
}));

import { ApiError } from './apiClient';
import { initAppStoreTransactions, loadAppStoreOffer, purchaseAppStorePlan, restoreAppStorePurchases } from './appStoreBilling';

const product = { id: 'sk.slovakgo.app.plus.monthly', displayName: 'Plus', description: '', displayPrice: '2,99 €', price: 2.99, currencyCode: 'EUR' };

describe('App Store billing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.finish.mockResolvedValue(undefined);
  });

  it('lists products in the server order with the account token', async () => {
    api.appleAccount.mockResolvedValue({ appAccountToken: 'token-1', productIds: ['m', 'y'] });
    store.getProducts.mockResolvedValue({ products: [{ ...product, id: 'y' }, { ...product, id: 'm' }] });
    const offer = await loadAppStoreOffer();
    expect(store.getProducts).toHaveBeenCalledWith({ productIds: ['m', 'y'] });
    expect(offer.appAccountToken).toBe('token-1');
    expect(offer.products.map(p => p.id)).toEqual(['m', 'y']);
  });

  it('finishes a purchase only after the server stored it', async () => {
    store.purchase.mockResolvedValue({ status: 'purchased', jws: 'jws-1', transactionId: '42' });
    api.submitAppleTransactions.mockResolvedValue({ ok: true });
    await expect(purchaseAppStorePlan(product, 'token-1')).resolves.toBe('purchased');
    expect(store.purchase).toHaveBeenCalledWith({ productId: product.id, appAccountToken: 'token-1' });
    expect(api.submitAppleTransactions).toHaveBeenCalledWith(['jws-1']);
    expect(store.finish).toHaveBeenCalledWith({ transactionId: '42' });
  });

  it('keeps the transaction unfinished when the server rejects it', async () => {
    store.purchase.mockResolvedValue({ status: 'purchased', jws: 'jws-1', transactionId: '42' });
    api.submitAppleTransactions.mockRejectedValue(new ApiError('belongs to another account', 409));
    await expect(purchaseAppStorePlan(product, 'token-1')).rejects.toMatchObject({ status: 409 });
    expect(store.finish).not.toHaveBeenCalled();
  });

  it('does not contact the server for cancelled or pending purchases', async () => {
    store.purchase.mockResolvedValueOnce({ status: 'cancelled' }).mockResolvedValueOnce({ status: 'pending' });
    await expect(purchaseAppStorePlan(product, 't')).resolves.toBe('cancelled');
    await expect(purchaseAppStorePlan(product, 't')).resolves.toBe('pending');
    expect(api.submitAppleTransactions).not.toHaveBeenCalled();
  });

  it('restores active subscriptions and reports when there are none', async () => {
    store.restore.mockResolvedValueOnce({ transactions: [{ jws: 'a', transactionId: '1' }] }).mockResolvedValueOnce({ transactions: [] });
    api.submitAppleTransactions.mockResolvedValue({ ok: true });
    await expect(restoreAppStorePurchases()).resolves.toBe(true);
    expect(api.submitAppleTransactions).toHaveBeenCalledWith(['a']);
    await expect(restoreAppStorePurchases()).resolves.toBe(false);
    expect(api.submitAppleTransactions).toHaveBeenCalledTimes(1);
  });

  it('syncs renewals delivered in the background and refreshes access', async () => {
    let listener: (t: { jws: string; transactionId: string }) => void = () => undefined;
    store.addListener.mockImplementation(async (_event: string, cb: typeof listener) => { listener = cb; return { remove: vi.fn() }; });
    api.submitAppleTransactions.mockResolvedValue({ ok: true });
    const onAccessChanged = vi.fn();
    await initAppStoreTransactions(onAccessChanged);
    listener({ jws: 'renewal', transactionId: '7' });
    await vi.waitFor(() => expect(onAccessChanged).toHaveBeenCalled());
    expect(store.finish).toHaveBeenCalledWith({ transactionId: '7' });
  });
});
