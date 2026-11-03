import { registerPlugin } from "@capacitor/core";
import { apiClient, ApiError } from "./apiClient";

export interface StorePeriod { unit: "day" | "week" | "month" | "year"; value: number }
export interface StoreProduct {
  id: string;
  displayName: string;
  description: string;
  /** Localised by the App Store for the learner's storefront, e.g. "2,99 €". */
  displayPrice: string;
  price: number;
  currencyCode: string;
  period?: StorePeriod;
  /** Present only when this Apple ID is still eligible for the introductory offer. */
  introOffer?: { paymentMode: "freeTrial" | "payAsYouGo" | "payUpFront"; displayPrice: string; period: StorePeriod; periodCount: number };
}
interface SignedTransaction { jws: string; transactionId: string }

/** Native StoreKit 2 bridge: ios/App/App/StorePlugin.swift. */
interface SlovakGoStorePlugin {
  getProducts(options: { productIds: string[] }): Promise<{ products: StoreProduct[] }>;
  purchase(options: { productId: string; appAccountToken: string }): Promise<{ status: "purchased" | "pending" | "cancelled" } & Partial<SignedTransaction>>;
  restore(): Promise<{ transactions: SignedTransaction[] }>;
  finish(options: { transactionId: string }): Promise<void>;
  manageSubscriptions(): Promise<void>;
  addListener(event: "transaction", listener: (transaction: SignedTransaction) => void): Promise<{ remove: () => Promise<void> }>;
}
const Store = registerPlugin<SlovakGoStorePlugin>("SlovakGoStore");

export interface AppStoreOffer { appAccountToken: string; products: StoreProduct[] }

/** Products in the order the server lists them (monthly first). */
export async function loadAppStoreOffer(): Promise<AppStoreOffer> {
  const { appAccountToken, productIds } = await apiClient.appleAccount();
  const { products } = await Store.getProducts({ productIds });
  const order = (p: StoreProduct) => productIds.indexOf(p.id);
  return { appAccountToken, products: [...products].sort((a, b) => order(a) - order(b)) };
}

/**
 * Sends transactions to the server and finishes them only once it has stored
 * them. Unfinished transactions are re-delivered by StoreKit on the next launch,
 * so a network failure here never loses a purchase.
 */
async function submit(transactions: SignedTransaction[]): Promise<void> {
  if (!transactions.length) return;
  await apiClient.submitAppleTransactions(transactions.map(t => t.jws));
  await Promise.all(transactions.map(t => Store.finish({ transactionId: t.transactionId }).catch(() => undefined)));
}

export type PurchaseOutcome = "purchased" | "pending" | "cancelled";
export async function purchaseAppStorePlan(product: StoreProduct, appAccountToken: string): Promise<PurchaseOutcome> {
  const result = await Store.purchase({ productId: product.id, appAccountToken });
  if (result.status === "purchased" && result.jws && result.transactionId) {
    await submit([{ jws: result.jws, transactionId: result.transactionId }]);
  }
  return result.status;
}

/** "Restore purchases". Returns false when this Apple ID has no active subscription. */
export async function restoreAppStorePurchases(): Promise<boolean> {
  const { transactions } = await Store.restore();
  await submit(transactions);
  return transactions.length > 0;
}

export function manageAppStoreSubscription(): Promise<void> {
  return Store.manageSubscriptions();
}

/**
 * Renewals, Ask to Buy approvals and purchases interrupted by a crash arrive
 * outside the paywall. Signed-out learners keep them unfinished until sign-in.
 */
export async function initAppStoreTransactions(onAccessChanged: () => void): Promise<void> {
  await Store.addListener("transaction", (transaction) => {
    submit([transaction]).then(onAccessChanged).catch((error: unknown) => {
      if (!(error instanceof ApiError && error.status === 401)) console.error("[app-store] transaction sync failed", error);
    });
  });
}

/** Server errors carry a learner-facing message; StoreKit errors do not. */
export function appStoreErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError && error.status !== 500 && error.message ? error.message : fallback;
}
