export type ScenarioGoal = "doctor" | "documents" | "work" | "rent" | "transport" | "school" | "default";

export interface Phrase { sk: string; uk: string }

export interface Scenario {
  goal: ScenarioGoal;
  title: string;
  phrases: Phrase[];
}

const SCENARIOS: Record<ScenarioGoal, Scenario> = {
  doctor: {
    goal: "doctor",
    title: "У лікаря",
    phrases: [
      { sk: "Mám bolesti brucha.", uk: "У мене болить живіт." },
      { sk: "Kde je lekáreň?", uk: "Де аптека?" },
      { sk: "Potrebujem recept.", uk: "Мені потрібен рецепт." },
      { sk: "Mám alergiu na penicilín.", uk: "У мене алергія на пеніцилін." },
      { sk: "Zavolajte záchranku.", uk: "Викличте швидку допомогу." },
    ],
  },
  documents: {
    goal: "documents",
    title: "Документи",
    phrases: [
      { sk: "Kde je cudzinecká polícia?", uk: "Де міграційна поліція?" },
      { sk: "Potrebujem predĺžiť povolenie.", uk: "Мені потрібно продовжити дозвіл." },
      { sk: "Stratil som pas.", uk: "Я загубив паспорт." },
      { sk: "Kde podať žiadosť?", uk: "Де подати заяву?" },
      { sk: "Kedy bude hotové?", uk: "Коли буде готово?" },
    ],
  },
  work: {
    goal: "work",
    title: "Робота",
    phrases: [
      { sk: "Hľadám prácu.", uk: "Я шукаю роботу." },
      { sk: "Mám záujem o túto pozíciu.", uk: "Мене цікавить ця посада." },
      { sk: "Kedy dostanem výplatu?", uk: "Коли я отримаю зарплату?" },
      { sk: "Pracujem na zmeny.", uk: "Я працюю позмінно." },
      { sk: "Potrebujem dovolenku.", uk: "Мені потрібна відпустка." },
    ],
  },
  rent: {
    goal: "rent",
    title: "Оренда",
    phrases: [
      { sk: "Hľadám byt na prenájom.", uk: "Я шукаю квартиру для оренди." },
      { sk: "Koľko stojí nájom?", uk: "Скільки коштує оренда?" },
      { sk: "Je k dispozícii parkovanie?", uk: "Чи є паркінг?" },
      { sk: "Kedy môžem nastúpiť?", uk: "Коли я можу заселитися?" },
      { sk: "Podpíšem zmluvu.", uk: "Я підпишу договір." },
    ],
  },
  transport: {
    goal: "transport",
    title: "Транспорт",
    phrases: [
      { sk: "Kde je zastávka autobusu?", uk: "Де зупинка автобуса?" },
      { sk: "Aký vlak ide do Bratislavy?", uk: "Який потяг їде до Братислави?" },
      { sk: "Koľko stojí lístok?", uk: "Скільки коштує квиток?" },
      { sk: "Kde si kúpim cestovný lístok?", uk: "Де купити проїзний?" },
      { sk: "Meškáme.", uk: "Ми запізнюємося." },
    ],
  },
  school: {
    goal: "school",
    title: "Школа",
    phrases: [
      { sk: "Kde je základná škola?", uk: "Де початкова школа?" },
      { sk: "Chcem zapísať dieťa do školy.", uk: "Я хочу записати дитину до школи." },
      { sk: "Kedy začína škola?", uk: "Коли починається школа?" },
      { sk: "Aké doklady treba?", uk: "Які документи потрібні?" },
      { sk: "Hovorí tu niekto po ukrajinskej?", uk: "Хтось тут говорить українською?" },
    ],
  },
  default: {
    goal: "default",
    title: "Щоденне спілкування",
    phrases: [
      { sk: "Dobrý deň!", uk: "Добрий день!" },
      { sk: "Ďakujem.", uk: "Дякую." },
      { sk: "Nerozumiem.", uk: "Я не розумію." },
      { sk: "Hovoríte po anglicky?", uk: "Ви говорите англійською?" },
      { sk: "Kde je WC?", uk: "Де туалет?" },
    ],
  },
};

const GOAL_KEYWORDS: [string, ScenarioGoal][] = [
  ["лікар", "doctor"],
  ["doctor", "doctor"],
  ["медицин", "doctor"],
  ["документ", "documents"],
  ["documents", "documents"],
  ["роботу", "work"],
  ["work", "work"],
  ["зайнятість", "work"],
  ["оренд", "rent"],
  ["rent", "rent"],
  ["квартир", "rent"],
  ["транспорт", "transport"],
  ["transport", "transport"],
  ["автобус", "transport"],
  ["школ", "school"],
  ["school", "school"],
  ["навчан", "school"],
];

export function getScenarioForGoal(goal?: string): Scenario {
  if (!goal) return SCENARIOS.default;
  const lower = goal.toLowerCase();
  for (const [keyword, mapped] of GOAL_KEYWORDS) {
    if (lower.includes(keyword)) return SCENARIOS[mapped];
  }
  return SCENARIOS.default;
}

export function getDailyPhrases(goal?: string, count = 3): Phrase[] {
  const scenario = getScenarioForGoal(goal);
  const dayNum = Math.floor(Date.now() / 86_400_000);
  const start = dayNum % scenario.phrases.length;
  return Array.from({ length: Math.min(count, scenario.phrases.length) }, (_, i) =>
    scenario.phrases[(start + i) % scenario.phrases.length]
  );
}
