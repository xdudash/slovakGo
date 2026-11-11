import { useCallback, useEffect, useState } from "react";
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
  save: (pct: number) => string; perMonth: (price: string) => string;
  restore: string; restoring: string; restored: string; nothingToRestore: string; buying: string; pending: string;
  unavailable: string; retry: string; failed: string; restoreFailed: string; legal: string; privacy: string; terms: string;
}> = {
  uk: {
    monthly: "Plus на місяць", yearly: "Plus на рік",
    trial: (p, price, r) => `${p} безкоштовно, далі ${price} / ${r}`, price: (price, r) => `${price} / ${r}`,
    restore: "Відновити покупки", restoring: "Відновлюємо…", restored: "Підписку відновлено.", nothingToRestore: "Активних підписок на цьому Apple ID не знайдено.",
    save: (n) => `Вигідніше на ${n}%`, perMonth: (v) => `≈ ${v} на місяць`,
    buying: "Відкриваємо App Store…", pending: "Покупка очікує підтвердження. Доступ відкриється, щойно App Store її підтвердить.",
    unavailable: "App Store зараз недоступний. Перевір з’єднання й спробуй ще раз.", retry: "Спробувати ще раз",
    failed: "Не вдалося завершити покупку. Гроші не списано, якщо App Store не показав підтвердження.",
    restoreFailed: "Не вдалося відновити покупки. Перевір з’єднання й спробуй ще раз.",
    legal: "Оплата списується з Apple ID після підтвердження. Підписка поновлюється автоматично, якщо не вимкнути автопоновлення щонайменше за 24 години до кінця періоду. Керувати підпискою й скасувати її можна в налаштуваннях Apple ID.",
    privacy: "Політика конфіденційності", terms: "Умови використання",
  },
  ru: {
    monthly: "Plus на месяц", yearly: "Plus на год",
    trial: (p, price, r) => `${p} бесплатно, затем ${price} / ${r}`, price: (price, r) => `${price} / ${r}`,
    restore: "Восстановить покупки", restoring: "Восстанавливаем…", restored: "Подписка восстановлена.", nothingToRestore: "Активных подписок на этом Apple ID не найдено.",
    save: (n) => `Выгоднее на ${n}%`, perMonth: (v) => `≈ ${v} в месяц`,
    buying: "Открываем App Store…", pending: "Покупка ожидает подтверждения. Доступ откроется, как только App Store её подтвердит.",
    unavailable: "App Store сейчас недоступен. Проверь соединение и попробуй ещё раз.", retry: "Попробовать ещё раз",
    failed: "Не удалось завершить покупку. Деньги не списаны, если App Store не показал подтверждение.",
    restoreFailed: "Не удалось восстановить покупки. Проверь соединение и попробуй ещё раз.",
    legal: "Оплата списывается с Apple ID после подтверждения. Подписка продлевается автоматически, если не отключить автопродление минимум за 24 часа до конца периода. Управлять подпиской и отменить её можно в настройках Apple ID.",
    privacy: "Политика конфиденциальности", terms: "Условия использования",
  },
  sk: {
    monthly: "Plus na mesiac", yearly: "Plus na rok",
    trial: (p, price, r) => `${p} zadarmo, potom ${price} / ${r}`, price: (price, r) => `${price} / ${r}`,
    restore: "Obnoviť nákupy", restoring: "Obnovujeme…", restored: "Predplatné je obnovené.", nothingToRestore: "Na tomto Apple ID sme nenašli aktívne predplatné.",
    save: (n) => `Ušetríš ${n} %`, perMonth: (v) => `≈ ${v} mesačne`,
    buying: "Otvárame App Store…", pending: "Nákup čaká na schválenie. Prístup sa otvorí, keď ho App Store potvrdí.",
    unavailable: "App Store je teraz nedostupný. Skontroluj pripojenie a skús to znova.", retry: "Skúsiť znova",
    failed: "Nákup sa nepodarilo dokončiť. Ak App Store nezobrazil potvrdenie, peniaze sa nestrhli.",
    restoreFailed: "Nákupy sa nepodarilo obnoviť. Skontroluj pripojenie a skús to znova.",
    legal: "Platba sa strhne z Apple ID po potvrdení. Predplatné sa obnovuje automaticky, ak automatické obnovenie nevypneš aspoň 24 hodín pred koncom obdobia. Predplatné spravuješ a zrušíš v nastaveniach Apple ID.",
    privacy: "Zásady ochrany súkromia", terms: "Podmienky používania",
  },
  en: {
    monthly: "Plus monthly", yearly: "Plus yearly",
    trial: (p, price, r) => `${p} free, then ${price} / ${r}`, price: (price, r) => `${price} / ${r}`,
    restore: "Restore purchases", restoring: "Restoring…", restored: "Your subscription has been restored.", nothingToRestore: "No active subscriptions found for this Apple ID.",
    save: (n) => `Save ${n}%`, perMonth: (v) => `≈ ${v} per month`,
    buying: "Opening the App Store…", pending: "The purchase is waiting for approval. Access opens as soon as the App Store confirms it.",
    unavailable: "The App Store is unavailable right now. Check your connection and try again.", retry: "Try again",
    failed: "The purchase could not be completed. You are not charged unless the App Store showed a confirmation.",
    restoreFailed: "Could not restore purchases. Check your connection and try again.",
    legal: "Payment is charged to your Apple ID at confirmation. The subscription renews automatically unless auto-renew is turned off at least 24 hours before the end of the period. Manage or cancel it in your Apple ID settings.",
    privacy: "Privacy Policy", terms: "Terms of Use",
  },
};

/** Yearly first: it is the better deal, and Apple shows the same order in Settings. */
function sortPlans(products: StoreProduct[]): StoreProduct[] {
  return [...products].sort((a, b) => (b.period?.unit === "year" ? 1 : 0) - (a.period?.unit === "year" ? 1 : 0));
}
const numberLocale: Record<Lang, string> = { uk: "uk-UA", ru: "ru-RU", sk: "sk-SK", en: "en-IE" };
function monthlyEquivalent(product: StoreProduct, lang: Lang): string {
  const months = (product.period?.value ?? 1) * 12;
  try {
    return new Intl.NumberFormat(numberLocale[lang], { style: "currency", currency: product.currencyCode }).format(Math.floor(product.price / months * 100) / 100);
  } catch { return ""; }
}

/** Subscription offer for the iOS app. Prices and trial eligibility come from the App Store. */
export function AppStoreOffer({ onActivated, onLoaded, disabled = false }: { onActivated?: () => void; onLoaded?: (offer: Offer) => void; disabled?: boolean }) {
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
      .then((next) => { setOffer(next); setLoadFailed(next.products.length === 0);  })
      .catch(() => setLoadFailed(true));
  }
  useEffect(load, []);
  useEffect(() => { if (offer) onLoaded?.(offer); }, [offer, onLoaded]);

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
      setMessage({ kind: "error", text: appStoreErrorMessage(error, c.restoreFailed) });
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
          {sortPlans(offer.products).map((product) => {
            const renewal = product.period ? periodText(lang, product.period) : "";
            const intro = product.introOffer?.paymentMode === "freeTrial" ? product.introOffer : null;
            const introLength = intro ? periodText(lang, { unit: intro.period.unit, value: intro.period.value * intro.periodCount }) : "";
            const yearly = product.period?.unit === "year";
            const monthly = offer.products.find((p) => p.period?.unit === "month");
            const saving = yearly && monthly && monthly.price > 0 ? Math.round((1 - product.price / (monthly.price * 12)) * 100) : 0;
            return (
              <button key={product.id} type="button" className={`app-store-plan${yearly ? " app-store-plan--best" : ""}`} disabled={disabled || busy !== null} onClick={() => void buy(product)}>
                {yearly && saving > 0 && <em className="app-store-plan-badge">{c.save(saving)}</em>}
                <span className="app-store-plan-row">
                  <strong>{yearly ? c.yearly : c.monthly}</strong>
                  <b>{product.displayPrice}</b>
                </span>
                <span>{busy === product.id ? c.buying : intro ? c.trial(introLength, product.displayPrice, renewal) : c.price(product.displayPrice, renewal)}</span>
                {yearly && <small>{c.perMonth(monthlyEquivalent(product, lang))}</small>}
              </button>
            );
          })}
        </div>
      )}

      <Button variant="ghost" disabled={disabled || busy !== null} onClick={() => void restore()}>
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

const paywallCopy: Record<Lang, { title: string; includes: string; perks: [string, string][]; admin: string; profile: string; logout: string }> = {
  uk: {
    title: "Перші 10 уроків пройдено 🎉", includes: "Що входить у Plus",
    perks: [["Усі рівні від A0 до C2", "понад 1000 уроків"], ["Практичні теми", "оренда житла, робота, лікар, поліція"],
      ["Словник і практика помилок", "повторюй усе, що вивчив"], ["Детальна статистика", "відстежуй свій прогрес"]],
    admin: "Режим перегляду адміністратора: учень бачить цей екран саме так. Покупки тут вимкнені.", profile: "Профіль", logout: "Вийти з акаунта",
  },
  ru: {
    title: "Первые 10 уроков пройдены 🎉", includes: "Что входит в Plus",
    perks: [["Все уровни от A0 до C2", "более 1000 уроков"], ["Практические темы", "аренда жилья, работа, врач, полиция"],
      ["Словарь и практика ошибок", "повторяй всё, что выучил"], ["Подробная статистика", "следи за своим прогрессом"]],
    admin: "Режим просмотра администратора: ученик видит этот экран так же. Покупки здесь отключены.", profile: "Профиль", logout: "Выйти из аккаунта",
  },
  sk: {
    title: "Prvých 10 lekcií máš za sebou 🎉", includes: "Čo obsahuje Plus",
    perks: [["Všetky úrovne od A0 po C2", "viac ako 1000 lekcií"], ["Praktické témy", "prenájom bytu, práca, lekár, polícia"],
      ["Slovník a precvičovanie chýb", "opakuj všetko, čo si sa naučil"], ["Podrobná štatistika", "sleduj svoj pokrok"]],
    admin: "Režim náhľadu administrátora: študent vidí túto obrazovku rovnako. Nákupy sú tu vypnuté.", profile: "Profil", logout: "Odhlásiť sa",
  },
  en: {
    title: "First 10 lessons done 🎉", includes: "What Plus includes",
    perks: [["All levels from A0 to C2", "1000+ lessons"], ["Practical topics", "renting, work, doctor, police"],
      ["Dictionary and mistake practice", "review everything you learned"], ["Detailed statistics", "track your progress"]],
    admin: "Admin preview: a learner sees this screen exactly like this. Purchases are disabled here.", profile: "Profile", logout: "Log out",
  },
};

/** iOS paywall: every string follows the app language, unlike the Ukrainian-only web paywall. */
export function AppStorePaywall({ adminPreview, onActivated, onProfile, onLogout }: {
  adminPreview: boolean; onActivated: () => void; onProfile: () => void; onLogout: () => void;
}) {
  const { lang: rawLang } = useT();
  const p = paywallCopy[(rawLang in paywallCopy ? rawLang : "uk") as Lang];
  return (
    <main className="page-content paywall-page app-store-paywall">
      <header className="app-store-paywall-head">
        <img src="/apple-icon.png" alt="" width="80" height="80" />
        <h1>{p.title}</h1>
      </header>
      {adminPreview && <p className="app-store-note">{p.admin}</p>}
      <section className="card app-store-perks">
        <h2>{p.includes}</h2>
        <ul>
          {p.perks.map(([title, detail]) => (
            <li key={title}><CheckCircle2 size={18} aria-hidden="true" /><span><strong>{title}</strong> — {detail}</span></li>
          ))}
        </ul>
      </section>
      <AppStoreOffer onActivated={onActivated} disabled={adminPreview} />
      <nav className="app-store-paywall-links">
        <button type="button" onClick={onProfile}>{p.profile}</button>
        <span aria-hidden="true">·</span>
        <button type="button" className="danger" onClick={onLogout}>{p.logout}</button>
      </nav>
    </main>
  );
}

type TrialStep = [string, string];
const introCopy: Record<Lang, {
  title: string; text: string; perks: string[]; skip: string; skipNote: string; later: string;
  winTitle: string; winText: string; winSkip: string; trialTitle: string;
  trialSteps: (length: string, price: string, renewal: string) => TrialStep[];
}> = {
  uk: {
    title: "Увесь словацький — з Plus", text: "Перші 10 уроків безкоштовні. Plus відкриває весь курс без обмежень.",
    perks: ["Усі рівні від A0 до C2", "Житло, робота, лікар, документи", "Повторення слів і помилок", "Повна статистика прогресу"],
    skip: "Почати з 10 безкоштовних уроків", skipNote: "Оформити Plus можна будь-коли в профілі.", later: "Не зараз",
    winTitle: "Перший урок пройдено!", winText: "Так тримати. Наступні безкоштовні уроки вже чекають, а Plus одразу відкриває весь курс — від A0 до C2.",
    winSkip: "Продовжити безкоштовно", trialTitle: "Як працює пробний період",
    trialSteps: (l, p, r) => [["Сьогодні", "Увесь курс відкрито — безкоштовно"], [`Через ${l}`, `Оплата ${p} / ${r}, якщо не скасуєш`], ["Будь-коли", "Скасування в налаштуваннях Apple ID, без дзвінків і листів"]],
  },
  ru: {
    title: "Весь словацкий — с Plus", text: "Первые 10 уроков бесплатные. Plus открывает весь курс без ограничений.",
    perks: ["Все уровни от A0 до C2", "Жильё, работа, врач, документы", "Повторение слов и ошибок", "Полная статистика прогресса"],
    skip: "Начать с 10 бесплатных уроков", skipNote: "Оформить Plus можно в любой момент в профиле.", later: "Не сейчас",
    winTitle: "Первый урок пройден!", winText: "Так держать. Следующие бесплатные уроки уже ждут, а Plus сразу открывает весь курс — от A0 до C2.",
    winSkip: "Продолжить бесплатно", trialTitle: "Как работает пробный период",
    trialSteps: (l, p, r) => [["Сегодня", "Весь курс открыт — бесплатно"], [`Через ${l}`, `Оплата ${p} / ${r}, если не отменишь`], ["В любой момент", "Отмена в настройках Apple ID, без звонков и писем"]],
  },
  sk: {
    title: "Celá slovenčina s Plus", text: "Prvých 10 lekcií je zadarmo. Plus odomkne celý kurz bez obmedzení.",
    perks: ["Všetky úrovne od A0 po C2", "Bývanie, práca, lekár, úrady", "Opakovanie slov a chýb", "Úplná štatistika pokroku"],
    skip: "Začať 10 lekciami zadarmo", skipNote: "Plus si môžeš aktivovať kedykoľvek v profile.", later: "Teraz nie",
    winTitle: "Prvá lekcia je hotová!", winText: "Len tak ďalej. Ďalšie lekcie zadarmo už čakajú a Plus hneď odomkne celý kurz — od A0 po C2.",
    winSkip: "Pokračovať zadarmo", trialTitle: "Ako funguje skúšobné obdobie",
    trialSteps: (l, p, r) => [["Dnes", "Celý kurz je odomknutý — zadarmo"], [`O ${l}`, `Platba ${p} / ${r}, ak nezrušíš`], ["Kedykoľvek", "Zrušíš v nastaveniach Apple ID, bez telefonátov a e-mailov"]],
  },
  en: {
    title: "All of Slovak with Plus", text: "Your first 10 lessons are free. Plus unlocks the whole course.",
    perks: ["Every level from A0 to C2", "Housing, work, doctor, paperwork", "Word and mistake review", "Full progress statistics"],
    skip: "Start with 10 free lessons", skipNote: "You can get Plus any time from your profile.", later: "Not now",
    winTitle: "First lesson done!", winText: "Nice work. More free lessons are waiting, and Plus unlocks the whole course right away — A0 to C2.",
    winSkip: "Continue for free", trialTitle: "How the free trial works",
    trialSteps: (l, p, r) => [["Today", "The whole course unlocks — free"], [`In ${l}`, `You pay ${p} / ${r} unless you cancel`], ["Any time", "Cancel in your Apple ID settings — no calls, no emails"]],
  },
};

/** Soft offer shown after the first lesson and from the free-lessons banner. Always skippable. */
export function PlusIntro({ onSkip, onActivated, skipLabel, variant = "default" }: {
  onSkip: () => void; onActivated: () => void; skipLabel?: string; variant?: "default" | "first-lesson";
}) {
  const { lang: rawLang } = useT();
  const lang = (rawLang in introCopy ? rawLang : "uk") as Lang;
  const c = introCopy[lang];
  const [trial, setTrial] = useState<TrialStep[] | null>(null);
  const win = variant === "first-lesson";

  const showTrial = useCallback((offer: Offer) => {
    const product = sortPlans(offer.products).find((p) => p.introOffer?.paymentMode === "freeTrial" && p.period);
    const intro = product?.introOffer;
    if (!product || !intro || !product.period) return;
    setTrial(c.trialSteps(periodText(lang, { unit: intro.period.unit, value: intro.period.value * intro.periodCount }), product.displayPrice, periodText(lang, product.period)));
  }, [c, lang]);

  return (
    <main className="plus-intro">
      <button type="button" className="plus-intro-close" onClick={onSkip}>{c.later}</button>
      <header className="plus-intro-head">
        {win
          ? <img src="/brand/mascot-cheer.webp" alt="" width="132" height="129" className="plus-intro-mascot" />
          : <img src="/brand/mascot-wink.webp" alt="" width="132" height="104" className="plus-intro-mascot" />}
        <span className="plus-intro-kicker">SlovakGO Plus</span>
        <h1>{win ? c.winTitle : c.title}</h1>
        <p>{win ? c.winText : c.text}</p>
      </header>
      <ul className="plus-intro-perks">
        {c.perks.map((perk) => <li key={perk}><CheckCircle2 size={18} aria-hidden="true" />{perk}</li>)}
      </ul>
      {trial && (
        <section className="plus-trial" aria-labelledby="plus-trial-title">
          <h2 id="plus-trial-title">{c.trialTitle}</h2>
          <ol>
            {trial.map(([when, what]) => <li key={when}><strong>{when}</strong><span>{what}</span></li>)}
          </ol>
        </section>
      )}
      <AppStoreOffer onActivated={onActivated} onLoaded={showTrial} />
      <button type="button" className="plus-intro-skip" onClick={onSkip}>{skipLabel ?? (win ? c.winSkip : c.skip)}</button>
      <p className="plus-intro-note">{c.skipNote}</p>
    </main>
  );
}
