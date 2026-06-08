import type { AppData, Exercise, Leaderboard, Lesson, Progress, User, UserLevel, Word } from "../types";
import { addDays } from "../utils/date";

const now = new Date("2026-06-01T12:00:00.000Z");

const topics: Array<{
  level: UserLevel;
  title: string;
  topic: string;
  words: Array<[string, string, string, string]>;
}> = [
  {
    level: "A0",
    title: "Алфавіт і вимова",
    topic: "Перші кроки",
    words: [
      ["abeceda", "алфавіт", "Slovenská abeceda má veľa znakov.", "Словацький алфавіт має багато знаків."],
      ["písmeno", "літера", "Toto písmeno je nové.", "Ця літера нова."],
      ["čítam", "я читаю", "Čítam pomaly.", "Я читаю повільно."],
      ["počúvam", "я слухаю", "Počúvam výslovnosť.", "Я слухаю вимову."],
      ["prosím", "будь ласка", "Prosím, zopakujte to.", "Будь ласка, повторіть це."]
    ]
  },
  {
    level: "A0",
    title: "Вітання та ввічливість",
    topic: "Перша розмова",
    words: [
      ["Dobrý deň", "добрий день", "Dobrý deň, vitajte.", "Добрий день, вітаємо."],
      ["Ahoj", "привіт", "Ahoj, ako sa máš?", "Привіт, як справи?"],
      ["ďakujem", "дякую", "Ďakujem pekne.", "Щиро дякую."],
      ["prepáčte", "вибачте", "Prepáčte, nerozumiem.", "Вибачте, я не розумію."],
      ["dovidenia", "до побачення", "Dovidenia a pekný deň.", "До побачення і гарного дня."]
    ]
  },
  {
    level: "A0",
    title: "Я з України",
    topic: "Знайомство",
    words: [
      ["som", "я є", "Som z Ukrajiny.", "Я з України."],
      ["bývam", "я живу", "Bývam v Bratislave.", "Я живу в Братиславі."],
      ["Ukrajina", "Україна", "Som z Ukrajiny.", "Я з України."],
      ["meno", "ім'я", "Moje meno je Olena.", "Мене звати Олена."],
      ["adresa", "адреса", "Toto je moja adresa.", "Це моя адреса."]
    ]
  },
  {
    level: "A0",
    title: "Числа, дати і час",
    topic: "Щоденні дані",
    words: [
      ["jeden", "один", "Mám jeden lístok.", "У мене один квиток."],
      ["dnes", "сьогодні", "Dnes mám čas.", "Сьогодні я маю час."],
      ["zajtra", "завтра", "Zajtra prídem.", "Завтра я прийду."],
      ["hodina", "година", "Je jedna hodina.", "Перша година."],
      ["mesiac", "місяць", "Platím každý mesiac.", "Я плачу щомісяця."]
    ]
  },
  {
    level: "A0",
    title: "Попросити повторити",
    topic: "Виживання",
    words: [
      ["nerozumiem", "я не розумію", "Nerozumiem tejto vete.", "Я не розумію це речення."],
      ["zopakovať", "повторити", "Môžete to zopakovať?", "Можете це повторити?"],
      ["napísať", "написати", "Môžete to napísať?", "Можете це написати?"],
      ["pomaly", "повільно", "Hovorte pomaly, prosím.", "Говоріть повільно, будь ласка."],
      ["otázka", "питання", "Mám otázku.", "У мене є питання."]
    ]
  },
  {
    level: "A1",
    title: "Магазин і ціни",
    topic: "Магазин",
    words: [
      ["chlieb", "хліб", "Prosím si chlieb.", "Мені, будь ласка, хліб."],
      ["cena", "ціна", "Aká je cena?", "Яка ціна?"],
      ["kartou", "карткою", "Môžem platiť kartou?", "Можна оплатити карткою?"],
      ["taška", "пакет", "Potrebujem tašku.", "Мені потрібен пакет."],
      ["účtenka", "чек", "Prosím si účtenku.", "Мені, будь ласка, чек."]
    ]
  },
  {
    level: "A1",
    title: "Транспорт і квитки",
    topic: "Транспорт",
    words: [
      ["lístok", "квиток", "Potrebujem lístok.", "Мені потрібен квиток."],
      ["stanica", "станція", "Kde je stanica?", "Де станція?"],
      ["vlak", "поїзд", "Vlak mešká.", "Потяг запізнюється."],
      ["autobus", "автобус", "Autobus ide o piatej.", "Автобус їде о п'ятій."],
      ["zastávka", "зупинка", "Kde je zastávka?", "Де зупинка?"]
    ]
  },
  {
    level: "A1",
    title: "Кафе і просте замовлення",
    topic: "Кафе",
    words: [
      ["káva", "кава", "Prosím si kávu.", "Мені, будь ласка, каву."],
      ["voda", "вода", "Prosím si vodu.", "Мені, будь ласка, воду."],
      ["jedálny lístok", "меню", "Máte jedálny lístok?", "У вас є меню?"],
      ["zaplatím", "я заплачу", "Zaplatím kartou.", "Я заплачу карткою."],
      ["bez cukru", "без цукру", "Kávu bez cukru, prosím.", "Каву без цукру, будь ласка."]
    ]
  },
  {
    level: "A1",
    title: "Аптека",
    topic: "Лікар / аптека",
    words: [
      ["lekáreň", "аптека", "Kde je lekáreň?", "Де аптека?"],
      ["bolesť", "біль", "Mám bolesť hlavy.", "У мене болить голова."],
      ["liek", "ліки", "Potrebujem liek.", "Мені потрібні ліки."],
      ["recept", "рецепт", "Mám recept od lekára.", "У мене рецепт від лікаря."],
      ["horúčka", "температура", "Mám horúčku.", "У мене температура."]
    ]
  },
  {
    level: "A1",
    title: "Оренда житла",
    topic: "Оренда",
    words: [
      ["prenájom", "оренда", "Hľadám byt na prenájom.", "Я шукаю квартиру в оренду."],
      ["nájomné", "орендна плата", "Nájomné je 700 eur.", "Оренда 700 євро."],
      ["kaucia", "застава", "Kaucia je dva nájmy.", "Застава становить дві оренди."],
      ["zmluva", "договір", "Chcem si prečítať zmluvu.", "Я хочу прочитати договір."],
      ["obhliadka", "перегляд", "Kedy je obhliadka?", "Коли перегляд?"]
    ]
  },
  {
    level: "A2",
    title: "Документи в установі",
    topic: "Документи",
    words: [
      ["doklad", "документ", "Potrebujem doklad.", "Мені потрібен документ."],
      ["žiadosť", "заява", "Vyplním žiadosť.", "Я заповню заяву."],
      ["pobyt", "проживання", "Mám prechodný pobyt.", "У мене тимчасове проживання."],
      ["termín", "запис", "Mám termín na úrade.", "У мене запис в установі."],
      ["úrad", "установа", "Idem na úrad.", "Я йду в установу."]
    ]
  },
  {
    level: "A2",
    title: "Робота і співбесіда",
    topic: "Робота",
    words: [
      ["práca", "робота", "Hľadám prácu.", "Я шукаю роботу."],
      ["pohovor", "співбесіда", "Mám pohovor zajtra.", "У мене співбесіда завтра."],
      ["zmluva", "договір", "Pracovná zmluva je dôležitá.", "Трудовий договір важливий."],
      ["mzda", "зарплата", "Aká je mzda?", "Яка зарплата?"],
      ["zmena", "зміна", "Pracujem rannú zmenu.", "Я працюю ранкову зміну."]
    ]
  },
  {
    level: "A2",
    title: "Лікар і симптоми",
    topic: "Лікар",
    words: [
      ["lekár", "лікар", "Potrebujem lekára.", "Мені потрібен лікар."],
      ["poistenie", "страхування", "Mám zdravotné poistenie.", "У мене медичне страхування."],
      ["termín", "прийом", "Mám termín u lekára.", "У мене прийом у лікаря."],
      ["kašeľ", "кашель", "Mám kašeľ.", "У мене кашель."],
      ["bolí ma", "у мене болить", "Bolí ma brucho.", "У мене болить живіт."]
    ]
  },
  {
    level: "A2",
    title: "Школа і дитина",
    topic: "Школа",
    words: [
      ["škola", "школа", "Dieťa chodí do školy.", "Дитина ходить до школи."],
      ["dieťa", "дитина", "Moje dieťa má sedem rokov.", "Моїй дитині сім років."],
      ["učiteľ", "вчитель", "Učiteľ mi poslal správu.", "Вчитель надіслав мені повідомлення."],
      ["trieda", "клас", "Dieťa je v druhej triede.", "Дитина у другому класі."],
      ["ospravedlnenie", "пояснення відсутності", "Potrebujem ospravedlnenie.", "Потрібне пояснення відсутності."]
    ]
  },
  {
    level: "A2",
    title: "Поскаржитися ввічливо",
    topic: "Комунікація",
    words: [
      ["problém", "проблема", "Mám problém s bytom.", "У мене проблема з квартирою."],
      ["sťažnosť", "скарга", "Chcem podať sťažnosť.", "Я хочу подати скаргу."],
      ["riešenie", "рішення", "Hľadáme riešenie.", "Шукаємо рішення."],
      ["nesúhlasím", "я не погоджуюся", "Nesúhlasím s tým.", "Я з цим не погоджуюся."],
      ["navrhujem", "пропоную", "Navrhujem nový termín.", "Пропоную новий час."]
    ]
  },
  {
    level: "B1",
    title: "Установи без паніки",
    topic: "Установи",
    words: [
      ["potvrdenie", "підтвердження", "Prosím si potvrdenie.", "Прошу підтвердження."],
      ["lehota", "строк", "Lehota je 30 dní.", "Строк 30 днів."],
      ["príloha", "додаток", "Príloha je k žiadosti.", "Додаток до заяви."],
      ["podpis", "підпис", "Tu je môj podpis.", "Ось мій підпис."],
      ["overenie", "засвідчення", "Potrebujem overenie.", "Мені потрібне засвідчення."]
    ]
  },
  {
    level: "B1",
    title: "Робоча ситуація",
    topic: "Робота",
    words: [
      ["nadriadený", "керівник", "Hovorím s nadriadeným.", "Я говорю з керівником."],
      ["úloha", "завдання", "Úloha je hotová.", "Завдання готове."],
      ["dohoda", "домовленість", "Máme dohodu.", "У нас є домовленість."],
      ["zodpovednosť", "відповідальність", "Je to moja zodpovednosť.", "Це моя відповідальність."],
      ["termín", "дедлайн", "Termín je piatok.", "Дедлайн у п'ятницю."]
    ]
  },
  {
    level: "B1",
    title: "Пояснити проблему лікарю",
    topic: "Лікар",
    words: [
      ["príznak", "симптом", "Príznaky trvajú týždeň.", "Симптоми тривають тиждень."],
      ["vyšetrenie", "обстеження", "Potrebujem vyšetrenie.", "Мені потрібне обстеження."],
      ["odporúčanie", "рекомендація", "Lekár dal odporúčanie.", "Лікар дав рекомендацію."],
      ["zhoršiť sa", "погіршитися", "Stav sa zhoršil.", "Стан погіршився."],
      ["zlepšiť sa", "покращитися", "Stav sa zlepšil.", "Стан покращився."]
    ]
  },
  {
    level: "B2",
    title: "Офіційний лист",
    topic: "Листування",
    words: [
      ["vážený", "шановний", "Vážený pán Novák.", "Шановний пане Новак."],
      ["žiadam", "прошу", "Žiadam o informáciu.", "Прошу інформацію."],
      ["prikladám", "додаю", "Prikladám dokument.", "Додаю документ."],
      ["vopred", "заздалегідь", "Ďakujem vopred.", "Дякую заздалегідь."],
      ["s pozdravom", "з повагою", "S pozdravom, Olena.", "З повагою, Олена."]
    ]
  },
  {
    level: "B2",
    title: "Аргументація",
    topic: "Дискусія",
    words: [
      ["dôvod", "причина", "Mám na to dôvod.", "У мене є причина."],
      ["názor", "думка", "Môj názor je iný.", "Моя думка інша."],
      ["výhoda", "перевага", "To je veľká výhoda.", "Це велика перевага."],
      ["nevýhoda", "недолік", "Vidím jednu nevýhodu.", "Бачу один недолік."],
      ["súvisí", "пов'язано", "Súvisí to s prácou.", "Це пов'язано з роботою."]
    ]
  },
  {
    level: "C1",
    title: "Професійна комунікація",
    topic: "Професія",
    words: [
      ["stanovisko", "позиція", "Naše stanovisko je jasné.", "Наша позиція зрозуміла."],
      ["podklad", "матеріал", "Posielam podklady.", "Надсилаю матеріали."],
      ["vyhodnotenie", "оцінка", "Vyhodnotenie je pripravené.", "Оцінка готова."],
      ["súlad", "відповідність", "Je to v súlade s pravidlami.", "Це відповідає правилам."],
      ["dopad", "вплив", "Dopad bude výrazný.", "Вплив буде значним."]
    ]
  }
];

function makeExercises(lessonId: string, words: Word[]): Exercise[] {
  const [first, second, third, fourth, fifth] = words;
  const optionPool = words.map((word) => word.uk);
  return [
    {
      id: `${lessonId}-ex-1`,
      lessonId,
      type: "multiple_choice_translation",
      question: `Що означає "${first.sk}"?`,
      options: optionPool,
      correctAnswer: first.uk,
      explanation: first.exampleUk,
      wordIds: [first.id],
      order: 1,
      difficulty: "easy"
    },
    {
      id: `${lessonId}-ex-2`,
      lessonId,
      type: "reverse_translation",
      question: `Обери словацький варіант: ${second.uk}`,
      options: words.map((word) => word.sk),
      correctAnswer: second.sk,
      explanation: second.exampleSk,
      wordIds: [second.id],
      order: 2,
      difficulty: "easy"
    },
    {
      id: `${lessonId}-ex-3`,
      lessonId,
      type: "true_false",
      question: `"${third.sk}" означає "${third.uk}".`,
      options: ["Правильно", "Неправильно"],
      correctAnswer: "Правильно",
      explanation: third.exampleUk,
      wordIds: [third.id],
      order: 3,
      difficulty: "easy"
    },
    {
      id: `${lessonId}-ex-4`,
      lessonId,
      type: "fill_blank",
      question: fourth.exampleSk?.replace(fourth.sk, "___") || `Встав слово: ___`,
      correctAnswer: fourth.sk,
      explanation: fourth.exampleUk,
      wordIds: [fourth.id],
      order: 4,
      difficulty: "medium"
    },
    {
      id: `${lessonId}-ex-5`,
      lessonId,
      type: "sentence_ordering",
      question: `Збери речення: ${fifth.exampleUk}`,
      options: (fifth.exampleSk || fifth.sk).replace(/[.?!]/g, "").split(" ").sort(() => 0.5 - Math.random()),
      correctAnswer: (fifth.exampleSk || fifth.sk).replace(/[.?!]/g, ""),
      explanation: "Звертай увагу на порядок слів у коротких фразах.",
      wordIds: [fifth.id],
      order: 5,
      difficulty: "medium"
    },
    {
      id: `${lessonId}-ex-6`,
      lessonId,
      type: "match_pairs",
      question: "З'єднай слова з перекладами.",
      options: words.slice(0, 4).flatMap((word) => [word.sk, word.uk]),
      correctAnswer: words.slice(0, 4).map((word) => `${word.sk}|${word.uk}`),
      explanation: "Пари зберігаються у словнику для повторення.",
      wordIds: words.slice(0, 4).map((word) => word.id),
      order: 6,
      difficulty: "medium"
    }
  ];
}

export const seedLessons: Lesson[] = topics.map((spec, index) => {
  const lessonId = `lesson-${index + 1}-${spec.level.toLowerCase()}`;
  const words: Word[] = spec.words.map(([sk, uk, exampleSk, exampleUk], wordIndex) => ({
    id: `${lessonId}-word-${wordIndex + 1}`,
    sk,
    uk,
    exampleSk,
    exampleUk,
    level: spec.level,
    topic: spec.topic,
    lessonId,
    tags: [spec.topic.toLowerCase()]
  }));
  return {
    id: lessonId,
    level: spec.level,
    title: spec.title,
    description: `Практичний урок для ситуації: ${spec.topic}.`,
    topic: spec.topic,
    order: index + 1,
    xpReward: spec.level === "A0" ? 12 : spec.level === "A1" ? 15 : 18,
    estimatedMinutes: spec.level === "A0" ? 6 : 8,
    isPublished: true,
    createdBy: "user-teacher",
    intro: "Коротко потренуй слова, фрази і реальні відповіді.",
    words,
    exercises: makeExercises(lessonId, words),
    completionMessage: "Урок завершено. Слова додані до словника.",
    updatedAt: now.toISOString()
  };
});

export const seedUsers: User[] = [
  {
    id: "user-student",
    name: "Студент",
    email: "student@slovaklife.local",
    role: "student",
    avatar: "SL",
    level: "A1",
    goal: "Документи",
    createdAt: now.toISOString(),
    lastActiveAt: now.toISOString(),
    subscriptionStatus: "trial",
    trialEndsAt: addDays(now, 14),
    onboardingDone: true,
    settings: { language: "uk", notificationsEnabled: true, soundEnabled: true, hapticsEnabled: true, dailyGoal: 10, theme: "default" }
  },
  {
    id: "user-teacher",
    name: "Викладач",
    email: "teacher@slovaklife.local",
    role: "teacher",
    avatar: "VK",
    level: "B2",
    createdAt: now.toISOString(),
    subscriptionStatus: "plus",
    onboardingDone: true,
    settings: { language: "uk", notificationsEnabled: false, soundEnabled: true, hapticsEnabled: false, theme: "default" }
  },
  {
    id: "user-admin",
    name: "Адмін",
    email: "admin@slovaklife.local",
    role: "admin",
    avatar: "AD",
    level: "C1",
    createdAt: now.toISOString(),
    subscriptionStatus: "plus",
    onboardingDone: true,
    settings: { language: "uk", notificationsEnabled: false, soundEnabled: false, hapticsEnabled: false, theme: "default" }
  }
];

export function createProgress(userId: string, level: UserLevel = "A0"): Progress {
  return {
    userId,
    currentLevel: level,
    currentLessonId: seedLessons.find((lesson) => lesson.level === level)?.id || seedLessons[0].id,
    completedLessons: [],
    lessonAttempts: [],
    xpTotal: userId === "user-student" ? 120 : 0,
    xpWeekly: userId === "user-student" ? 75 : 0,
    hearts: 5,
    maxHearts: 5,
    streakDays: userId === "user-student" ? 3 : 0,
    lastPracticeDate: userId === "user-student" ? now.toISOString() : undefined,
    streakFreezeCount: 1,
    coins: 80,
    mistakes: [],
    achievements: [],
    updatedAt: now.toISOString()
  };
}

export const seedLeaderboard: Leaderboard = {
  weekId: "2026-W23",
  league: "Bronze",
  entries: [
    { userId: "fake-1",  name: "Марія",   xpWeekly: 320, rank: 1,  movement: "up",   country: "UA" },
    { userId: "fake-2",  name: "Андрій",  xpWeekly: 260, rank: 2,  movement: "same", country: "UA" },
    { userId: "fake-3",  name: "Оксана",  xpWeekly: 210, rank: 3,  movement: "up",   country: "UA" },
    { userId: "fake-5",  name: "Дмитро",  xpWeekly: 185, rank: 4,  movement: "up",   country: "UA" },
    { userId: "fake-6",  name: "Петро",   xpWeekly: 150, rank: 5,  movement: "same", country: "UA" },
    { userId: "fake-7",  name: "Софія",   xpWeekly: 130, rank: 6,  movement: "down", country: "UA" },
    { userId: "user-student", name: "Студент", xpWeekly: 75, rank: 7, movement: "same", country: "UA" },
    { userId: "fake-8",  name: "Marek",   xpWeekly: 65,  rank: 8,  movement: "up",   country: "SK" },
    { userId: "fake-4",  name: "Ірина",   xpWeekly: 60,  rank: 9,  movement: "down", country: "UA" },
    { userId: "fake-9",  name: "Tomáš",   xpWeekly: 40,  rank: 10, movement: "down", country: "SK" }
  ],
  history: [
    {
      weekId: "2026-W22",
      entries: [
        { userId: "fake-2",  name: "Андрій",  xpWeekly: 290, rank: 1, movement: "up",   country: "UA" },
        { userId: "fake-1",  name: "Марія",   xpWeekly: 270, rank: 2, movement: "down", country: "UA" },
        { userId: "fake-5",  name: "Дмитро",  xpWeekly: 195, rank: 3, movement: "up",   country: "UA" },
        { userId: "fake-3",  name: "Оксана",  xpWeekly: 180, rank: 4, movement: "down", country: "UA" },
        { userId: "fake-6",  name: "Петро",   xpWeekly: 140, rank: 5, movement: "same", country: "UA" },
        { userId: "user-student", name: "Студент", xpWeekly: 90, rank: 6, movement: "same", country: "UA" },
        { userId: "fake-7",  name: "Софія",   xpWeekly: 85,  rank: 7, movement: "up",   country: "UA" },
        { userId: "fake-8",  name: "Marek",   xpWeekly: 55,  rank: 8, movement: "same", country: "SK" },
        { userId: "fake-4",  name: "Ірина",   xpWeekly: 50,  rank: 9, movement: "down", country: "UA" },
        { userId: "fake-9",  name: "Tomáš",   xpWeekly: 30,  rank: 10,movement: "down", country: "SK" }
      ]
    }
  ]
};

export const seedData: AppData = {
  users: seedUsers,
  lessons: seedLessons,
  progress: {
    "user-student": {
      ...createProgress("user-student", "A1"),
      completedLessons: [seedLessons[0].id, seedLessons[1].id],
      currentLessonId: seedLessons[2].id
    },
    "user-teacher": createProgress("user-teacher", "B2"),
    "user-admin": createProgress("user-admin", "C1")
  },
  userWords: {
    "user-student": []
  },
  leaderboard: seedLeaderboard,
  syncQueue: [],
  updatedAt: now.toISOString()
};
