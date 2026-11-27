import { DAILY_XP_GOAL } from "../../shared/economy";

export type RewardsLang = "uk" | "ru" | "sk" | "en";

export const rewardsCopy: Record<RewardsLang, {
  chestTitle: string; chestDone: string; chestOpen: string; chestWon: (n: number) => string; chestTomorrow: string;
  taskLesson: string; taskPractice: string; taskXp: string; goPractice: string;
  milestone: (days: number, crowns: number) => string; comet: string;
  league: (rank: number, crowns: number) => string; leagueHint: string; dismiss: string;
  discount: (pct: number, days: number) => string; earnChest: string; earnInvite: string; earnLeague: string; earnStreak: string;
  cometLock: string;
}> = {
  uk: {
    chestTitle: "Скриня дня", chestDone: "Усе виконано — відкривай!", chestOpen: "Відкрити скриню", chestWon: (n) => `+${n} корон зі скрині`, chestTomorrow: "Нова скриня завтра",
    taskLesson: "Пройти урок", taskPractice: "Потренувати слова", taskXp: `Набрати ${DAILY_XP_GOAL} XP`, goPractice: "До практики",
    milestone: (d, c) => `${d} днів поспіль! +${c} корон`, comet: "І рамка «Комета» — твоя.",
    league: (r, c) => `${r} місце минулого тижня! +${c} корон`, leagueHint: "Топ-3 тижня отримують 100, 60 і 30 корон.", dismiss: "Закрити",
    discount: (p, d) => `Знижка за серію −${p}% · ${d} дн. поспіль`, earnChest: "Скриня дня", earnInvite: "Друг пройшов перший урок", earnLeague: "Топ-3 тижня", earnStreak: "Серія 3 / 7 / 14 / 30 днів",
    cometLock: "30 днів",
  },
  ru: {
    chestTitle: "Сундук дня", chestDone: "Всё выполнено — открывай!", chestOpen: "Открыть сундук", chestWon: (n) => `+${n} корон из сундука`, chestTomorrow: "Новый сундук завтра",
    taskLesson: "Пройти урок", taskPractice: "Потренировать слова", taskXp: `Набрать ${DAILY_XP_GOAL} XP`, goPractice: "К практике",
    milestone: (d, c) => `${d} дней подряд! +${c} корон`, comet: "И рамка «Комета» — твоя.",
    league: (r, c) => `${r} место на прошлой неделе! +${c} корон`, leagueHint: "Топ-3 недели получают 100, 60 и 30 корон.", dismiss: "Закрыть",
    discount: (p, d) => `Скидка за серию −${p}% · ${d} дн. подряд`, earnChest: "Сундук дня", earnInvite: "Друг прошёл первый урок", earnLeague: "Топ-3 недели", earnStreak: "Серия 3 / 7 / 14 / 30 дней",
    cometLock: "30 дней",
  },
  sk: {
    chestTitle: "Truhlica dňa", chestDone: "Všetko splnené — otvor ju!", chestOpen: "Otvoriť truhlicu", chestWon: (n) => `+${n} korún z truhlice`, chestTomorrow: "Nová truhlica zajtra",
    taskLesson: "Prejsť lekciu", taskPractice: "Precvičiť slová", taskXp: `Získať ${DAILY_XP_GOAL} XP`, goPractice: "Na precvičovanie",
    milestone: (d, c) => `${d} dní za sebou! +${c} korún`, comet: "A rámček Kométa je tvoj.",
    league: (r, c) => `${r}. miesto minulý týždeň! +${c} korún`, leagueHint: "Top 3 týždňa dostanú 100, 60 a 30 korún.", dismiss: "Zavrieť",
    discount: (p, d) => `Zľava za sériu −${p} % · ${d} dní za sebou`, earnChest: "Truhlica dňa", earnInvite: "Kamarát prešiel prvú lekciu", earnLeague: "Top 3 týždňa", earnStreak: "Séria 3 / 7 / 14 / 30 dní",
    cometLock: "30 dní",
  },
  en: {
    chestTitle: "Daily chest", chestDone: "All done — open it!", chestOpen: "Open the chest", chestWon: (n) => `+${n} crowns from the chest`, chestTomorrow: "A new chest tomorrow",
    taskLesson: "Finish a lesson", taskPractice: "Practise words", taskXp: `Earn ${DAILY_XP_GOAL} XP`, goPractice: "Go to practice",
    milestone: (d, c) => `${d} days in a row! +${c} crowns`, comet: "And the Comet frame is yours.",
    league: (r, c) => `#${r} last week! +${c} crowns`, leagueHint: "This week's top 3 get 100, 60 and 30 crowns.", dismiss: "Close",
    discount: (p, d) => `Streak discount −${p}% · ${d} days in a row`, earnChest: "Daily chest", earnInvite: "A friend finishes a first lesson", earnLeague: "Weekly top 3", earnStreak: "Streak of 3 / 7 / 14 / 30 days",
    cometLock: "30 days",
  },
};

export function rewardsLang(lang: string): RewardsLang {
  return (lang in rewardsCopy ? lang : "uk") as RewardsLang;
}
