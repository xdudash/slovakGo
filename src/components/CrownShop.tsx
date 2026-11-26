import { useState } from "react";
import { BookOpen, Check, Flame, Lock, Snowflake, Sparkles } from "lucide-react";
import { CROWNS, FRAMES, FREEZE_PRICE, MAX_FREEZES, canWearFrame, type FrameRarity } from "../../shared/economy";
import { useT } from "../i18n";
import { track } from "../services/analytics";
import { selectCurrentUser, useAppStore } from "../store/useAppStore";
import { CrownIcon, UserAvatar } from "./UserAvatar";

type Lang = "uk" | "ru" | "sk" | "en";

const copy: Record<Lang, {
  wallet: string; balance: string; earn: string; earnLesson: string; earnPerfect: string; earnDay: string; earnPractice: string; plusBonus: string;
  freezeTitle: string; freezeText: string; freezeHave: (n: number) => string; buy: string; full: string;
  framesTitle: string; framesText: string; wear: string; worn: string; plusOnly: string; short: (n: number) => string;
  names: Record<string, string>; rarity: Record<FrameRarity, string>;
}> = {
  uk: {
    wallet: "Мої корони", balance: "корон у гаманці", earn: "Як заробити",
    earnLesson: "Пройти новий урок", earnPerfect: "Урок без помилок", earnDay: "Перше заняття дня", earnPractice: "Практика слів", plusBonus: "З Plus корон на 50% більше",
    freezeTitle: "Заморозка серії", freezeText: "Пропустиш день — серія не згорить.", freezeHave: (n) => `Є: ${n} з ${MAX_FREEZES}`, buy: "Купити", full: "Максимум",
    framesTitle: "Рамки аватара", framesText: "Видно в профілі й у рейтингу.", wear: "Вдягнути", worn: "Вдягнуто", plusOnly: "Plus", short: (n) => `Ще ${n}`,
    names: { simple: "Проста", lime: "Лайм", violet: "Фіолетова", ice: "Крижана", gold: "Золота", fire: "Вогонь" },
    rarity: { common: "Звичайна", rare: "Рідкісна", epic: "Епічна", legendary: "Легендарна" },
  },
  ru: {
    wallet: "Мои короны", balance: "корон в кошельке", earn: "Как заработать",
    earnLesson: "Пройти новый урок", earnPerfect: "Урок без ошибок", earnDay: "Первое занятие дня", earnPractice: "Практика слов", plusBonus: "С Plus корон на 50% больше",
    freezeTitle: "Заморозка серии", freezeText: "Пропустишь день — серия не сгорит.", freezeHave: (n) => `Есть: ${n} из ${MAX_FREEZES}`, buy: "Купить", full: "Максимум",
    framesTitle: "Рамки аватара", framesText: "Видно в профиле и в рейтинге.", wear: "Надеть", worn: "Надета", plusOnly: "Plus", short: (n) => `Ещё ${n}`,
    names: { simple: "Простая", lime: "Лайм", violet: "Фиолетовая", ice: "Ледяная", gold: "Золотая", fire: "Огонь" },
    rarity: { common: "Обычная", rare: "Редкая", epic: "Эпическая", legendary: "Легендарная" },
  },
  sk: {
    wallet: "Moje koruny", balance: "korún v peňaženke", earn: "Ako zarobiť",
    earnLesson: "Nová lekcia", earnPerfect: "Lekcia bez chyby", earnDay: "Prvé učenie dňa", earnPractice: "Precvičovanie slov", plusBonus: "S Plus o 50 % viac korún",
    freezeTitle: "Zmrazenie série", freezeText: "Vynecháš deň a séria nezhorí.", freezeHave: (n) => `Máš: ${n} z ${MAX_FREEZES}`, buy: "Kúpiť", full: "Maximum",
    framesTitle: "Rámčeky avatara", framesText: "Vidno ich v profile aj v rebríčku.", wear: "Nasadiť", worn: "Nasadený", plusOnly: "Plus", short: (n) => `Ešte ${n}`,
    names: { simple: "Jednoduchý", lime: "Limetka", violet: "Fialový", ice: "Ľadový", gold: "Zlatý", fire: "Oheň" },
    rarity: { common: "Bežný", rare: "Vzácny", epic: "Epický", legendary: "Legendárny" },
  },
  en: {
    wallet: "My crowns", balance: "crowns in your wallet", earn: "How to earn",
    earnLesson: "Finish a new lesson", earnPerfect: "Lesson with no mistakes", earnDay: "First session of the day", earnPractice: "Word practice", plusBonus: "Plus earns 50% more crowns",
    freezeTitle: "Streak freeze", freezeText: "Miss a day and your streak survives.", freezeHave: (n) => `You have ${n} of ${MAX_FREEZES}`, buy: "Buy", full: "Maxed out",
    framesTitle: "Avatar frames", framesText: "Shown on your profile and the leaderboard.", wear: "Wear", worn: "Worn", plusOnly: "Plus", short: (n) => `${n} more`,
    names: { simple: "Simple", lime: "Lime", violet: "Violet", ice: "Ice", gold: "Gold", fire: "Fire" },
    rarity: { common: "Common", rare: "Rare", epic: "Epic", legendary: "Legendary" },
  },
};

function useEconomyCopy() {
  const { lang } = useT();
  return copy[(lang in copy ? lang : "uk") as Lang];
}

/** Crowns wallet, streak freezes and avatar frames: the free half of the shop. */
export function CrownShop() {
  const c = useEconomyCopy();
  const user = useAppStore((s) => selectCurrentUser(s.data, s.currentUserId));
  const progress = useAppStore((s) => (s.currentUserId ? s.data.progress[s.currentUserId] : undefined));
  const buyItem = useAppStore((s) => s.buyItem);
  const updateUser = useAppStore((s) => s.updateUser);
  const [justBought, setJustBought] = useState<string | null>(null);
  if (!user || !progress) return null;

  const coins = progress.coins ?? 0;
  const owned = progress.ownedItems ?? [];
  const worn = user.frame ?? "simple";

  function buy(item: string, price: number) {
    if (buyItem(item)) {
      track("shop_buy", { item, price });
      setJustBought(item);
      if (item.startsWith("frame:")) updateUser({ frame: item.slice("frame:".length) });
    }
  }

  const earn = [
    { icon: <BookOpen size={18} />, label: c.earnLesson, value: `+${CROWNS.lesson}` },
    { icon: <Check size={18} />, label: c.earnPerfect, value: `+${CROWNS.perfect}` },
    { icon: <Flame size={18} />, label: c.earnDay, value: `+${CROWNS.streakDay}` },
    { icon: <Sparkles size={18} />, label: c.earnPractice, value: `+${CROWNS.practice}` },
  ];

  return (
    <section className="crown-shop" aria-label={c.wallet}>
      <div className="crown-wallet">
        <CrownIcon size={40} />
        <strong className="crown-wallet-n">{coins}</strong>
        <span>{c.balance}</span>
      </div>

      <h2 className="crown-shop-h">{c.framesTitle}</h2>
      <p className="crown-shop-sub">{c.framesText}</p>
      <div className="frame-grid">
        {FRAMES.map((frame) => {
          const wearable = canWearFrame(frame.id, owned, user.subscriptionStatus);
          const isWorn = worn === frame.id;
          const short = frame.price - coins;
          return (
            <div key={frame.id} className={`frame-card${isWorn ? " is-worn" : ""}${justBought === `frame:${frame.id}` ? " is-new" : ""}`}>
              <UserAvatar name={user.name} avatar={user.avatar} frame={frame.id} size={56} />
              <strong>{c.names[frame.id] ?? frame.id}</strong>
              <span className={`frame-rarity frame-rarity--${frame.rarity}`}>{c.rarity[frame.rarity]}</span>
              {isWorn ? <span className="frame-action is-worn"><Check size={14} /> {c.worn}</span>
                : wearable ? <button type="button" className="frame-action" onClick={() => updateUser({ frame: frame.id })}>{c.wear}</button>
                : frame.plusOnly ? <span className="frame-action is-locked"><Lock size={13} /> {c.plusOnly}</span>
                : short > 0 ? <span className="frame-action is-locked" title={c.short(short)} aria-label={c.short(short)}><CrownIcon size={13} /> {frame.price}</span>
                : <button type="button" className="frame-action is-buy" onClick={() => buy(`frame:${frame.id}`, frame.price)}><CrownIcon size={13} /> {frame.price}</button>}
            </div>
          );
        })}
      </div>

      <div className="freeze-card">
        <span className="freeze-card-icon"><Snowflake size={22} /></span>
        <div className="freeze-card-text">
          <strong>{c.freezeTitle}</strong>
          <span>{c.freezeText} {c.freezeHave(progress.streakFreezeCount)}</span>
        </div>
        <button type="button" className="frame-action is-buy" disabled={progress.streakFreezeCount >= MAX_FREEZES || coins < FREEZE_PRICE}
          onClick={() => buy("freeze", FREEZE_PRICE)}>
          {progress.streakFreezeCount >= MAX_FREEZES ? c.full : <><CrownIcon size={13} /> {FREEZE_PRICE}</>}
        </button>
      </div>

      <h2 className="crown-shop-h">{c.earn}</h2>
      <ul className="crown-earn">
        {earn.map((row) => (
          <li key={row.label}><span className="crown-earn-icon">{row.icon}</span>{row.label}<b>{row.value}</b></li>
        ))}
      </ul>
      <p className="crown-shop-sub">{c.plusBonus}</p>
    </section>
  );
}
