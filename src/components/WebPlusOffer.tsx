import { useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "./ui";
import { useT } from "../i18n";
import { apiClient } from "../services/apiClient";
import { openExternalUrl } from "../services/platform";
import { track } from "../services/analytics";
import { selectCurrentUser, useAppStore } from "../store/useAppStore";

type Lang = "uk" | "ru" | "sk" | "en";
type Plan = "yearly" | "monthly";

/** Web (Stripe) prices; api/_lib/stripe.ts validPrice() rejects any other amount. */
const PRICE = { yearly: 20, monthly: 3 } as const;
const perMonth = (PRICE.yearly / 12).toFixed(2);
const saving = Math.round((1 - PRICE.yearly / (PRICE.monthly * 12)) * 100);

const copy: Record<Lang, {
  title: string; text: string; perks: string[]; yearly: string; monthly: string; perYear: string; perMonthLabel: string;
  approx: string; save: string; trialCta: string; buyCta: string; loading: string; trialNote: (plan: Plan) => string;
  buyNote: (plan: Plan) => string; skip: string; skipNote: string; later: string; failed: string;
}> = {
  uk: {
    title: "Пройди свій план з Plus", text: "Увесь курс від A0 до C2 відкрито одразу. Або почни з 10 безкоштовних уроків.",
    perks: ["Усі рівні від A0 до C2 — понад 1000 уроків", "Житло, робота, лікар, документи", "Повторення слів і помилок"],
    yearly: "Рік", monthly: "Місяць", perYear: "/ рік", perMonthLabel: "/ міс", approx: `≈ €${perMonth} на місяць`, save: `−${saving}%`,
    trialCta: "Почати 3 дні безкоштовно", buyCta: "Оформити Plus", loading: "Завантаження…",
    trialNote: (p) => `Сьогодні без оплати. Через 3 дні — €${PRICE[p]} ${p === "yearly" ? "за рік" : "на місяць"}, якщо не скасуєш. Потрібна картка; скасувати можна будь-коли.`,
    buyNote: (p) => `€${PRICE[p]} ${p === "yearly" ? "за рік" : "на місяць"}, автоматичне поновлення до скасування.`,
    skip: "Почати безкоштовно", skipNote: "Без картки. Plus можна оформити будь-коли в профілі.", later: "Не зараз",
    failed: "Не вдалося почати оформлення. Спробуй ще раз.",
  },
  ru: {
    title: "Пройди свой план с Plus", text: "Весь курс от A0 до C2 открыт сразу. Или начни с 10 бесплатных уроков.",
    perks: ["Все уровни от A0 до C2 — более 1000 уроков", "Жильё, работа, врач, документы", "Повторение слов и ошибок"],
    yearly: "Год", monthly: "Месяц", perYear: "/ год", perMonthLabel: "/ мес", approx: `≈ €${perMonth} в месяц`, save: `−${saving}%`,
    trialCta: "Начать 3 дня бесплатно", buyCta: "Оформить Plus", loading: "Загрузка…",
    trialNote: (p) => `Сегодня без оплаты. Через 3 дня — €${PRICE[p]} ${p === "yearly" ? "за год" : "в месяц"}, если не отменишь. Нужна карта; отменить можно в любой момент.`,
    buyNote: (p) => `€${PRICE[p]} ${p === "yearly" ? "за год" : "в месяц"}, автоматическое продление до отмены.`,
    skip: "Начать бесплатно", skipNote: "Без карты. Plus можно оформить в любой момент в профиле.", later: "Не сейчас",
    failed: "Не удалось начать оформление. Попробуй ещё раз.",
  },
  sk: {
    title: "Prejdi svoj plán s Plus", text: "Celý kurz od A0 po C2 je hneď odomknutý. Alebo začni 10 lekciami zadarmo.",
    perks: ["Všetky úrovne od A0 po C2 — viac ako 1000 lekcií", "Bývanie, práca, lekár, úrady", "Opakovanie slov a chýb"],
    yearly: "Rok", monthly: "Mesiac", perYear: "/ rok", perMonthLabel: "/ mes.", approx: `≈ ${perMonth} € mesačne`, save: `−${saving} %`,
    trialCta: "Začať 3 dni zadarmo", buyCta: "Aktivovať Plus", loading: "Načítava sa…",
    trialNote: (p) => `Dnes bez platby. O 3 dni ${PRICE[p]} € ${p === "yearly" ? "za rok" : "mesačne"}, ak nezrušíš. Potrebuješ kartu; zrušiť sa dá kedykoľvek.`,
    buyNote: (p) => `${PRICE[p]} € ${p === "yearly" ? "za rok" : "mesačne"}, automatické obnovenie až do zrušenia.`,
    skip: "Začať zadarmo", skipNote: "Bez karty. Plus si môžeš aktivovať kedykoľvek v profile.", later: "Teraz nie",
    failed: "Aktiváciu sa nepodarilo spustiť. Skús to znova.",
  },
  en: {
    title: "Follow your plan with Plus", text: "The whole course from A0 to C2 opens right away. Or start with 10 free lessons.",
    perks: ["Every level from A0 to C2 — 1000+ lessons", "Housing, work, doctor, paperwork", "Word and mistake review"],
    yearly: "Year", monthly: "Month", perYear: "/ year", perMonthLabel: "/ mo", approx: `≈ €${perMonth} a month`, save: `−${saving}%`,
    trialCta: "Start 3 days free", buyCta: "Get Plus", loading: "Loading…",
    trialNote: (p) => `Nothing to pay today. After 3 days, €${PRICE[p]} ${p === "yearly" ? "a year" : "a month"} unless you cancel. Card required; cancel any time.`,
    buyNote: (p) => `€${PRICE[p]} ${p === "yearly" ? "a year" : "a month"}, renews automatically until cancelled.`,
    skip: "Start for free", skipNote: "No card needed. You can get Plus any time from your profile.", later: "Not now",
    failed: "Couldn't start checkout. Please try again.",
  },
};

/**
 * Web twin of the iOS PlusIntro: a skippable Plus offer with the yearly plan
 * preselected, paid through Stripe Checkout.
 */
export function WebPlusOffer({ from, onSkip }: { from: string; onSkip: () => void }) {
  const { lang: rawLang } = useT();
  const lang = (rawLang in copy ? rawLang : "uk") as Lang;
  const c = copy[lang];
  const user = useAppStore((s) => selectCurrentUser(s.data, s.currentUserId));
  const trial = !user?.hasUsedTrial;
  const [plan, setPlan] = useState<Plan>("yearly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subscribe() {
    setLoading(true);
    setError(null);
    try {
      track("checkout_start", { from, plan });
      const { url } = await apiClient.createCheckoutSession(plan);
      await openExternalUrl(url);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : c.failed);
      setLoading(false);
    }
  }

  return (
    <main className="plus-intro plus-intro--web">
      <button type="button" className="plus-intro-close" onClick={onSkip}>{c.later}</button>
      <header className="plus-intro-head">
        <img src="/brand/mascot-plan.webp" alt="" width="128" height="120" className="plus-intro-mascot" />
        <span className="plus-intro-kicker">SlovakGO Plus</span>
        <h1>{c.title}</h1>
        <p>{c.text}</p>
      </header>
      <ul className="plus-intro-perks">
        {c.perks.map((perk) => <li key={perk}><CheckCircle2 size={18} aria-hidden="true" />{perk}</li>)}
      </ul>

      <div className="web-plus-plans" role="radiogroup" aria-label="SlovakGO Plus">
        {(["yearly", "monthly"] as const).map((p) => (
          <label key={p} className={`web-plus-plan${plan === p ? " is-selected" : ""}`}>
            <input type="radio" name="plus-plan" value={p} checked={plan === p} onChange={() => setPlan(p)} />
            <span className="web-plus-plan-name">
              <strong>{p === "yearly" ? c.yearly : c.monthly}</strong>
              {p === "yearly" && <small>{c.approx}</small>}
            </span>
            {p === "yearly" && <em className="web-plus-plan-badge">{c.save}</em>}
            <b>€{PRICE[p]} {p === "yearly" ? c.perYear : c.perMonthLabel}</b>
          </label>
        ))}
      </div>

      {error && (
        <div className="shop-error-banner" role="alert"><AlertCircle size={18} /><span>{error}</span></div>
      )}

      <Button onClick={() => void subscribe()} disabled={loading} style={{ width: "100%" }}>
        {loading ? c.loading : trial ? c.trialCta : c.buyCta}
      </Button>
      <p className="plus-intro-note">{trial ? c.trialNote(plan) : c.buyNote(plan)}</p>
      <button type="button" className="plus-intro-skip" onClick={onSkip}>{c.skip}</button>
      <p className="plus-intro-note">{c.skipNote}</p>
    </main>
  );
}
