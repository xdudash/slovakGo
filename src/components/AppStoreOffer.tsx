import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "./ui";
import { useT } from "../i18n";
import { useAppStore } from "../store/useAppStore";
import {
  appStoreErrorMessage, loadAppStoreOffer, purchaseAppStorePlan, restoreAppStorePurchases,
  type AppStoreOffer as Offer, type StorePeriod, type StoreProduct,
} from "../services/appStoreBilling";

export const PRIVACY_POLICY_URL = "https://www.slovakgo.sk/privacy";
/** Apple's standard licence agreement, used until SlovakGO publishes its own terms. */
export const TERMS_OF_USE_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

type Lang = "uk" | "ru" | "sk" | "en";
const unitNames: Record<Lang, Record<StorePeriod["unit"], [string, string, string]>> = {
  uk: { day: ["день", "дні", "днів"], week: ["тиждень", "тижні", "тижнів"], month: ["місяць", "місяці", "місяців"], year: ["рік", "роки", "років"] },
  ru: { day: ["день", "дня", "дней"], week: ["неделя", "недели", "недель"], month: ["месяц", "месяца", "месяцев"], year: ["год", "года", "лет"] },
  sk: { day: ["deň", "dni", "dní"], week: ["týždeň", "týždne", "týždňov"], month: ["mesiac", "mesiace", "mesiacov"], year: ["rok", "roky", "rokov"] },
  en: { day: ["day", "days", "days"], week: ["week", "weeks", "weeks"], month: ["month", "months", "months"], year: ["year", "years", "years"] },
};
function periodText(lang: Lang, { unit, value }: StorePeriod): string {
  const [one, few, many] = unitNames[lang][unit];
  if (value === 1) return one;
  const form = lang === "en" ? few
    : lang === "sk" ? (value >= 2 && value <= 4 ? few : many)
      : (value % 10 >= 2 && value % 10 <= 4 && (value % 100 < 10 || value % 100 >= 20) ? few : many);
  return `${value} ${form}`;
}

const copy: Record<Lang, {
  monthly: string; yearly: string; trial: (period: string, price: string, renewal: string) => string; price: (price: string, renewal: string) => string;
  restore: string; restoring: string; restored: string; nothingToRestore: string; buying: string; pending: string;
  unavailable: string; retry: string; failed: string; legal: string; privacy: string; terms: string;
}> = {
  uk: {
    monthly: "Plus на місяць", yearly: "Plus на рік",
    trial: (p, price, r) => `${p} безкоштовно, далі ${price} / ${r}`, price: (price, r) => `${price} / ${r}`,
    restore: "Відновити покупки", restoring: "Відновлюємо…", restored: "Підписку відновлено.", nothingToRestore: "Активних підписок на цьому Apple ID не знайдено.",
    buying: "Відкриваємо App Store…", pending: "Покупка очікує підтвердження. Доступ відкриється, щойно App Store її підтвердить.",
    unavailable: "App Store зараз недоступний. Перевір з’єднання й спробуй ще раз.", retry: "Спробувати ще раз",
    failed: "Не вдалося завершити покупку. Гроші не списано, якщо App Store не показав підтвердження.",
    legal: "Оплата списується з Apple ID після підтвердження. Підписка поновлюється автоматично, якщо не вимкнути автопоновлення щонайменше за 24 години до кінця періоду. Керувати підпискою й скасувати її можна в налаштуваннях Apple ID.",
    privacy: "Політика конфіденційності", terms: "Умови використання",
  },
  ru: {
    monthly: "Plus на месяц", yearly: "Plus на год",
    trial: (p, price, r) => `${p} бесплатно, затем ${price} / ${r}`, price: (price, r) => `${price} / ${r}`,
    restore: "Восстановить покупки", restoring: "Восстанавливаем…", restored: "Подписка восстановлена.", nothingToRestore: "Активных подписок на этом Apple ID не найдено.",
    buying: "Открываем App Store…", pending: "Покупка ожидает подтверждения. Доступ откроется, как только App Store её подтвердит.",
    unavailable: "App Store сейчас недоступен. Проверь соединение и попробуй ещё раз.", retry: "Попробовать ещё раз",
    failed: "Не удалось завершить покупку. Деньги не списаны, если App Store не показал подтверждение.",
    legal: "Оплата списывается с Apple ID после подтверждения. Подписка продлевается автоматически, если не отключить автопродление минимум за 24 часа до конца периода. Управлять подпиской и отменить её можно в настройках Apple ID.",
    privacy: "Политика конфиденциальности", terms: "Условия использования",
  },
  sk: {
    monthly: "Plus na mesiac", yearly: "Plus na rok",
    trial: (p, price, r) => `${p} zadarmo, potom ${price} / ${r}`, price: (price, r) => `${price} / ${r}`,
    restore: "Obnoviť nákupy", restoring: "Obnovujeme…", restored: "Predplatné je obnovené.", nothingToRestore: "Na tomto Apple ID sme nenašli aktívne predplatné.",
    buying: "Otvárame App Store…", pending: "Nákup čaká na schválenie. Prístup sa otvorí, keď ho App Store potvrdí.",
    unavailable: "App Store je teraz nedostupný. Skontroluj pripojenie a skús to znova.", retry: "Skúsiť znova",
    failed: "Nákup sa nepodarilo dokončiť. Ak App Store nezobrazil potvrdenie, peniaze sa nestrhli.",
    legal: "Platba sa strhne z Apple ID po potvrdení. Predplatné sa obnovuje automaticky, ak automatické obnovenie nevypneš aspoň 24 hodín pred koncom obdobia. Predplatné spravuješ a zrušíš v nastaveniach Apple ID.",
    privacy: "Zásady ochrany súkromia", terms: "Podmienky používania",
  },
  en: {
    monthly: "Plus monthly", yearly: "Plus yearly",
    trial: (p, price, r) => `${p} free, then ${price} / ${r}`, price: (price, r) => `${price} / ${r}`,
    restore: "Restore purchases", restoring: "Restoring…", restored: "Your subscription has been restored.", nothingToRestore: "No active subscriptions found for this Apple ID.",
    buying: "Opening the App Store…", pending: "The purchase is waiting for approval. Access opens as soon as the App Store confirms it.",
    unavailable: "The App Store is unavailable right now. Check your connection and try again.", retry: "Try again",
    failed: "The purchase could not be completed. You are not charged unless the App Store showed a confirmation.",
    legal: "Payment is charged to your Apple ID at confirmation. The subscription renews automatically unless auto-renew is turned off at least 24 hours before the end of the period. Manage or cancel it in your Apple ID settings.",
    privacy: "Privacy Policy", terms: "Terms of Use",
  },
};

/** Subscription offer for the iOS app. Prices and trial eligibility come from the App Store. */
export function AppStoreOffer({ onActivated }: { onActivated?: () => void }) {
  const { lang: rawLang } = useT();
  const lang = (rawLang in copy ? rawLang : "uk") as Lang;
  const c = copy[lang];
  const refreshUser = useAppStore((s) => s.refreshUser);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  function load() {
    setLoadFailed(false);
    loadAppStoreOffer()
      .then((next) => { setOffer(next); setLoadFailed(next.products.length === 0); })
      .catch(() => setLoadFailed(true));
  }
  useEffect(load, []);

  async function activated() {
    await refreshUser();
    onActivated?.();
  }

  async function buy(product: StoreProduct) {
    if (!offer) return;
    setBusy(product.id);
    setMessage(null);
    try {
      const outcome = await purchaseAppStorePlan(product, offer.appAccountToken);
      if (outcome === "purchased") await activated();
      if (outcome === "pending") setMessage({ kind: "info", text: c.pending });
    } catch (error) {
      setMessage({ kind: "error", text: appStoreErrorMessage(error, c.failed) });
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setBusy("restore");
    setMessage(null);
    try {
      if (await restoreAppStorePurchases()) {
        setMessage({ kind: "info", text: c.restored });
        await activated();
      } else {
        setMessage({ kind: "info", text: c.nothingToRestore });
      }
    } catch (error) {
      setMessage({ kind: "error", text: appStoreErrorMessage(error, c.unavailable) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="app-store-offer">
      {message && (
        <div className={message.kind === "error" ? "shop-error-banner" : "app-store-note"} role="status">
          {message.kind === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      {loadFailed ? (
        <div className="app-store-unavailable">
          <p>{c.unavailable}</p>
          <Button variant="secondary" onClick={load}>{c.retry}</Button>
        </div>
      ) : !offer ? (
        <div className="app-store-plans" aria-busy="true">
          <div className="app-store-plan app-store-plan--loading" />
          <div className="app-store-plan app-store-plan--loading" />
        </div>
      ) : (
        <div className="app-store-plans">
          {offer.products.map((product) => {
            const renewal = product.period ? periodText(lang, product.period) : "";
            const intro = product.introOffer?.paymentMode === "freeTrial" ? product.introOffer : null;
            const introLength = intro ? periodText(lang, { unit: intro.period.unit, value: intro.period.value * intro.periodCount }) : "";
            return (
              <button key={product.id} type="button" className="app-store-plan" disabled={busy !== null} onClick={() => void buy(product)}>
                <strong>{product.period?.unit === "year" ? c.yearly : c.monthly}</strong>
                <span>{busy === product.id ? c.buying : intro ? c.trial(introLength, product.displayPrice, renewal) : c.price(product.displayPrice, renewal)}</span>
              </button>
            );
          })}
        </div>
      )}

      <Button variant="ghost" disabled={busy !== null} onClick={() => void restore()}>
        {busy === "restore" ? c.restoring : c.restore}
      </Button>

      <p className="app-store-legal">{c.legal}</p>
      <p className="app-store-links">
        <a href={TERMS_OF_USE_URL} target="_blank" rel="noreferrer">{c.terms}</a>
        <span aria-hidden="true">·</span>
        <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer">{c.privacy}</a>
      </p>
    </div>
  );
}
