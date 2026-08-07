import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Globe, Smartphone, Zap } from "lucide-react";
import { useAppStore, selectCurrentUser } from "../../store/useAppStore";
import { getGuestLanguage, setGuestLanguage } from "../../i18n";
import "../../styles/globals.css";

const content = {
  uk: {
    nav: {
      app: "Перейти в додаток",
      login: "Увійти",
      startFree: "Почати безкоштовно",
    },
    hero: {
      badge: "Для українців у Словаччині",
      titleStart: "Словацька від ",
      titleEnd: "0 до B2",
      desc: "Від першого слова до впевненої розмови в аптеці, на роботі й у лікаря — за 15 хвилин на день. Без реєстрації. Без оплати. Просто спробуй.",
      cta: "Почати навчання безкоштовно",
      stats: "500+ українців вже з нами",
    },
    features: {
      title: "Чому SlovakGO вчить словацьку швидше",
      desc: "Стандартні курси вчать граматику у відриві від реального життя. SlovakGO — кожен урок навколо конкретної ситуації, з якою стикається кожен українець у перші місяці в Словаччині.",
      f1: { label: "Виживання", title: "Сценарії з реального життя", desc: "Оренда квартири, Cudzinecká polícia, школа — вчиш саме те, що потрібно вже завтра, а не абстрактну граматику." },
      f2: { label: "Кар'єра", title: "Робота та документи", desc: "Співбесіда, Úrad práce, Sociálna poisťovňa — реальні фрази для реальних українських ситуацій у Словаччині." },
      f3: { label: "Прогрес", title: "XP, серії та ліги", desc: "Збирай бали, тримай серію — середня серія учнів SlovakGO 12 днів. Щоденна звичка формується за 2 тижні." },
      f4: { label: "Контекст", title: "Жива розмовна мова", desc: "Слова які реально вживають у Bratislava, Košice, Prešov — не книжна норма, а те що почуєш на вулиці." },
    },
    compare: {
      title: "Словацька та українська — ближче, ніж ти думаєш",
      desc: "Обидві мови належать до слов'янської групи та мають спільні корені. Близько 30–40% базової лексики словацької (Slovenčina) впізнається українськомовним читачем без жодної підготовки.",
      th1: "Українська", th2: "Словацька (Slovenčina)", th3: "Різниця",
      w1: { u: "вода", s: "voda", d: "однакова" },
      w2: { u: "місто", s: "mesto", d: "майже однакова" },
      w3: { u: "хліб", s: "chlieb", d: "схожа" },
      w4: { u: "добрий", s: "dobrý", d: "схожа" },
      w5: { u: "мати", s: "mať", d: "однакова" },
    },
    path: {
      label: "Твій шлях за рівнями CEFR",
      title: "Від A0 до вільного B2 за словацькою мовою",
      desc: "CEFR (Загальноєвропейські рекомендації з мовної освіти) — міжнародна шкала рівнів знання мови від A1 (початковий) до C2 (досконалий).",
      s1: { title: "A0–A1: Старт", text: "Алфавіт, вимова, базові фрази для виживання. Більшість учнів проходять за 3–4 тижні." },
      s2: { title: "A2: Виживання", text: "Магазин, транспорт, оренда житла. Достатньо для щоденного життя. Ціль — 2–3 місяці." },
      s3: { title: "B1: Адаптація", text: "Робота, лікарі, документи в Cudzinecká polícia. Потрібно для більшості робочих місць." },
      s4: { title: "B2: Свобода", text: "Вільні дискусії, професійна лексика, переговори. Відкриває офісні та управлінські позиції." },
    },
    pricing: {
      title: "Спочатку спробуй навчання на практиці",
      desc: "Перший розділ доступний без оплати. Потім — 7 днів повного доступу та вибір зручного тарифу.",
      monthly: { badge: "Базовий", title: "Щомісячний", price: "€9,99", period: "/міс", text: "Гнучка оплата щомісяця" },
      yearly: { badge: "7 днів пробного доступу", title: "Річний", price: "€4,99", period: "/міс", text: "Оплата €59,88 раз на рік (Економія 50%)" },
      f1: "Безлімітні серця", f2: "Офлайн доступ до уроків", f3: "Розширена аналітика", f4: "Пріоритетна підтримка",
      cta: "Почати навчання безкоштовно",
    },
    faq: {
      title: "Часті запитання",
      desc: "Відповіді на найпопулярніші питання від українців у Словаччині.",
      q1: { q: "Скільки часу займає вивчення словацької з нуля?", a: "Більшість учнів досягають рівня A2 (базове виживання) за 3–4 місяці при заняттях 15 хвилин на день. Для рівня B1 (робочий рівень) потрібно приблизно 6–9 місяців. Українськомовним учням легше — спільна слов'янська база прискорює засвоєння лексики." },
      q2: { q: "Чи схожа словацька мова на українську?", a: "Так — обидві є слов'янськими мовами та мають спільну базову лексику. Такі слова як voda (вода), mesto (місто), dobrý (добрий) українці розуміють без перекладу. Основна складність — вимова та деякі граматичні форми." },
      q3: { q: "Який рівень словацької потрібен для роботи у Словаччині?", a: "Для більшості виробничих та сервісних позицій достатньо рівня A2–B1. Для офісної роботи або позицій з клієнтами потрібен B2. Úrad práce (Центр зайнятості) може запропонувати безкоштовні курси." },
      q4: { q: "Як зареєструватися в Словаччині як громадянин України?", a: "Потрібно звернутися до Cudzinecká polícia (Відділу у справах іноземців) за місцем проживання. Необхідні: паспорт, договір оренди або лист від роботодавця. SlovakGO має спеціальний урок з лексикою для цього процесу." },
      q5: { q: "Чи можна вчити словацьку без інтернету?", a: "Так — користувачі SlovakGO Plus можуть завантажувати уроки для офлайн вивчення. Прогрес синхронізується автоматично при появі інтернету." },
      q6: { q: "Чи потрібна словацька для медичного обслуговування?", a: "Більшість лікарів розуміють базову англійську або російську, проте знання словацьких медичних термінів суттєво пришвидшує візит. У нас є окремий урок \"У лікаря\"." },
    },
    about: {
      title: "Про SlovakGO",
      p1: "SlovakGO створений щоб допомогти українцям швидко адаптуватися до життя у Словаччині через мову. Кожен урок побудований на реальних сценаріях, які збирали безпосередньо від українців у Братиславі, Кошице, Пряшеві та інших містах.",
      p2: "Наш підхід: 10–15 хвилин на день замість годинних лекцій. Уроки охоплюють рівні від A0 до B2 за шкалою CEFR — від першого слова до вільної розмови.",
    },
    footer: {
      title: "Готовий почати розмовляти словацькою?",
      desc: "Приєднуйся до 500+ українців, які вже вивчають словацьку через SlovakGO і впевнено почуваються в Словаччині.",
      cta: "Почати навчання безкоштовно",
    }
  },
  ru: {
    nav: {
      app: "Перейти в приложение",
      login: "Войти",
      startFree: "Начать бесплатно",
    },
    hero: {
      badge: "Для украинцев в Словакии",
      titleStart: "Словацкий от ",
      titleEnd: "0 до B2",
      desc: "От первого слова до уверенного разговора в аптеке, на работе и у врача — за 15 минут в день. Без регистрации. Без оплаты. Просто попробуй.",
      cta: "Начать обучение бесплатно",
      stats: "500+ украинцев уже с нами",
    },
    features: {
      title: "Почему SlovakGO учит словацкому быстрее",
      desc: "Стандартные курсы учат грамматику в отрыве от реальной жизни. SlovakGO — каждый урок вокруг конкретной ситуации, с которой сталкивается каждый украинец в первые месяцы в Словакии.",
      f1: { label: "Выживание", title: "Сценарии из реальной жизни", desc: "Аренда квартиры, Cudzinecká polícia, школа — учишь именно то, что нужно уже завтра, а не абстрактную грамматику." },
      f2: { label: "Карьера", title: "Работа и документы", desc: "Собеседование, Úrad práce, Sociálna poisťovňa — реальные фразы для реальных украинских ситуаций в Словакии." },
      f3: { label: "Прогресс", title: "XP, серии и лиги", desc: "Собирай баллы, держи серию — средняя серия учеников SlovakGO 12 дней. Ежедневная привычка формируется за 2 недели." },
      f4: { label: "Контекст", title: "Живая разговорная речь", desc: "Слова, которые реально используют в Bratislava, Košice, Prešov — не книжная норма, а то, что услышишь на улице." },
    },
    compare: {
      title: "Словацкий и украинский — ближе, чем ты думаешь",
      desc: "Оба языка относятся к славянской группе и имеют общие корни. Около 30–40% базовой лексики словацкого (Slovenčina) узнается русскоязычным читателем без подготовки.",
      th1: "Русский/Украинский", th2: "Словацкий (Slovenčina)", th3: "Разница",
      w1: { u: "вода", s: "voda", d: "одинаковая" },
      w2: { u: "город", s: "mesto", d: "похожая (мiсто)" },
      w3: { u: "хлеб", s: "chlieb", d: "похожая" },
      w4: { u: "добрый", s: "dobrý", d: "похожая" },
      w5: { u: "иметь", s: "mať", d: "похожая (мати)" },
    },
    path: {
      label: "Твой путь по уровням CEFR",
      title: "От A0 до свободного B2 по словацкому языку",
      desc: "CEFR (Общеевропейские компетенции владения иностранным языком) — международная шкала уровней знания языка от A1 (начальный) до C2 (совершенный).",
      s1: { title: "A0–A1: Старт", text: "Алфавит, произношение, базовые фразы для выживания. Большинство учеников проходят за 3–4 недели." },
      s2: { title: "A2: Выживание", text: "Магазин, транспорт, аренда жилья. Достаточно для повседневной жизни. Цель — 2–3 месяца." },
      s3: { title: "B1: Адаптация", text: "Работа, врачи, документы в Cudzinecká polícia. Нужно для большинства рабочих мест." },
      s4: { title: "B2: Свобода", text: "Свободные дискуссии, профессиональная лексика, переговоры. Открывает офисные и управленческие позиции." },
    },
    pricing: {
      title: "Сначала попробуй обучение на практике",
      desc: "Первый раздел доступен без оплаты. Затем — 7 дней полного доступа и выбор удобного тарифа.",
      monthly: { badge: "Базовый", title: "Ежемесячный", price: "€9,99", period: "/мес", text: "Гибкая оплата каждый месяц" },
      yearly: { badge: "7 дней пробного доступа", title: "Годовой", price: "€4,99", period: "/мес", text: "Оплата €59,88 раз в год (Экономия 50%)" },
      f1: "Безлимитные сердца", f2: "Офлайн доступ к урокам", f3: "Расширенная аналитика", f4: "Приоритетная поддержка",
      cta: "Начать обучение бесплатно",
    },
    faq: {
      title: "Частые вопросы",
      desc: "Ответы на самые популярные вопросы от украинцев в Словакии.",
      q1: { q: "Сколько времени занимает изучение словацкого с нуля?", a: "Большинство учеников достигают уровня A2 (базовое выживание) за 3–4 месяца при занятиях 15 минут в день. Для уровня B1 (рабочий уровень) нужно примерно 6–9 месяцев." },
      q2: { q: "Похож ли словацкий язык на русский/украинский?", a: "Да — они являются славянскими языками и имеют общую базовую лексику. Такие слова как voda (вода), mesto (город), dobrý (добрый) понятны без перевода. Основная сложность — произношение и некоторые грамматические формы." },
      q3: { q: "Какой уровень словацкого нужен для работы в Словакии?", a: "Для большинства производственных и сервисных позиций достаточно уровня A2–B1. Для офисной работы или позиций с клиентами нужен B2. Úrad práce (Центр занятости) может предложить бесплатные курсы." },
      q4: { q: "Как зарегистрироваться в Словакии как гражданин Украины?", a: "Нужно обратиться в Cudzinecká polícia (Отдел по делам иностранцев) по месту жительства. Необходимы: паспорт, договор аренды или письмо от работодателя. SlovakGO имеет специальный урок с лексикой для этого процесса." },
      q5: { q: "Можно ли учить словацкий без интернета?", a: "Да — пользователи SlovakGO Plus могут скачивать уроки для офлайн изучения. Прогресс синхронизируется автоматически при появлении интернета." },
      q6: { q: "Нужен ли словацкий для медицинского обслуживания?", a: "Большинство врачей понимают базовый английский или русский, однако знание словацких медицинских терминов существенно ускоряет визит. У нас есть отдельный урок \"У врача\"." },
    },
    about: {
      title: "О SlovakGO",
      p1: "SlovakGO создан, чтобы помочь украинцам быстро адаптироваться к жизни в Словакии через язык. Каждый урок построен на реальных сценариях, которые мы собирали непосредственно от украинцев в Братиславе, Кошице, Пряшеве и других городах.",
      p2: "Наш подход: 10–15 минут в день вместо часовых лекций. Уроки охватывают уровни от A0 до B2 по шкале CEFR — от первого слова до свободного разговора.",
    },
    footer: {
      title: "Готов начать говорить по-словацки?",
      desc: "Присоединяйся к 500+ украинцам, которые уже изучают словацкий через SlovakGO и уверенно чувствуют себя в Словакии.",
      cta: "Начать обучение бесплатно",
    }
  }
};

export function LandingPage() {
  const { data, currentUserId } = useAppStore();
  const user = selectCurrentUser(data, currentUserId);
  const [lang, setLang] = useState(getGuestLanguage());

  useEffect(() => {
    const handleLangChange = () => setLang(getGuestLanguage());
    window.addEventListener('languagechange', handleLangChange);
    return () => window.removeEventListener('languagechange', handleLangChange);
  }, []);

  const t = content[lang === 'ru' ? 'ru' : 'uk'];

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://www.slovakgo.sk/#website",
        "url": "https://www.slovakgo.sk/",
        "name": "SlovakGO",
        "inLanguage": lang === 'ru' ? 'ru' : 'uk',
        "potentialAction": {
          "@type": "SearchAction",
          "target": "https://www.slovakgo.sk/?s={search_term_string}",
          "query-input": "required name=search_term_string"
        }
      }
    ]
  };

  return (
    <div className="landing-wrap">
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>

      {/* ── Navigation ──────────────────────────────────────────────── */}
      <nav className="landing-nav">
        <div className="nav-container">
          <div className="landing-logo">
            <img src="/apple-icon.png" alt="SlovakGO логотип" className="logo-icon-sm" />
            <span>SlovakGO</span>
          </div>
          <div className="nav-actions">
            <div className="nav-lang-switcher" style={{ display: 'flex', gap: '4px', marginRight: '12px' }}>
              <button 
                onClick={() => setGuestLanguage('uk')}
                className={`nav-lang-btn ${lang !== 'ru' ? 'active' : ''}`}
              >
                UA
              </button>
              <button 
                onClick={() => setGuestLanguage('ru')}
                className={`nav-lang-btn ${lang === 'ru' ? 'active' : ''}`}
              >
                RU
              </button>
            </div>
            {user ? (
              <Link to="/app" className="btn btn-secondary btn-sm">{t.nav.app}</Link>
            ) : (
              <>
                <Link to="/login" className="nav-link">{t.nav.login}</Link>
                <Link to="/demo" className="btn btn-primary btn-sm">{t.nav.startFree}</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero Section ────────────────────────────────────────────── */}
      <header className="hero-section">
        <div className="hero-inner">
          <div className="hero-content">
            <div className="hero-badge">
              <Zap size={13} fill="var(--yellow)" color="var(--yellow)" />
              <span>{t.hero.badge}</span>
            </div>
            <h1>{t.hero.titleStart}<span>{t.hero.titleEnd}</span></h1>
            <p>{t.hero.desc}</p>
            <div className="hero-cta">
              <Link to="/demo" className="btn btn-primary btn-lg">
                {t.hero.cta} <ArrowRight size={18} />
              </Link>
              <div className="hero-stats">
                <div className="mini-avatars">
                  <div className="avatar-m" style={{background: '#fecaca'}}>О</div>
                  <div className="avatar-m" style={{background: '#a5f3fc'}}>М</div>
                  <div className="avatar-m" style={{background: '#bbf7d0'}}>А</div>
                </div>
                <span>{t.hero.stats}</span>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="phone-mockup">
              <div className="mockup-screen">
                <img src="/slovakgo-preview.png" alt="SlovakGO — екран уроку словацької мови" loading="lazy" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Features Grid ───────────────────────────────────────────── */}
      <section className="features-section">
        <div className="section-header">
          <h2>{t.features.title}</h2>
          <p>{t.features.desc}</p>
        </div>
        <div className="features-grid">
          <FeatureCard color="var(--accent)" label={t.features.f1.label} title={t.features.f1.title} desc={t.features.f1.desc} />
          <FeatureCard color="var(--yellow-dark)" label={t.features.f2.label} title={t.features.f2.title} desc={t.features.f2.desc} />
          <FeatureCard color="var(--success)" label={t.features.f3.label} title={t.features.f3.title} desc={t.features.f3.desc} />
          <FeatureCard color="var(--blue)" label={t.features.f4.label} title={t.features.f4.title} desc={t.features.f4.desc} />
        </div>
      </section>

      {/* ── Slovak vs Ukrainian ─────────────────────────────────────── */}
      <section className="advantage-section">
        <div className="section-header">
          <h2>{t.compare.title}</h2>
          <p>{t.compare.desc}</p>
        </div>
        <div className="comparison-table">
          <table>
            <thead>
              <tr>
                <th>{t.compare.th1}</th>
                <th>{t.compare.th2}</th>
                <th>{t.compare.th3}</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>{t.compare.w1.u}</td><td>{t.compare.w1.s}</td><td>{t.compare.w1.d}</td></tr>
              <tr><td>{t.compare.w2.u}</td><td>{t.compare.w2.s}</td><td>{t.compare.w2.d}</td></tr>
              <tr><td>{t.compare.w3.u}</td><td>{t.compare.w3.s}</td><td>{t.compare.w3.d}</td></tr>
              <tr><td>{t.compare.w4.u}</td><td>{t.compare.w4.s}</td><td>{t.compare.w4.d}</td></tr>
              <tr><td>{t.compare.w5.u}</td><td>{t.compare.w5.s}</td><td>{t.compare.w5.d}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Learning Path ───────────────────────────────────────────── */}
      <section className="path-teaser">
        <div className="path-content">
          <div className="label">{t.path.label}</div>
          <h2>{t.path.title}</h2>
          <p style={{marginBottom: '24px', color: 'var(--muted)', fontSize: '0.95rem'}}>{t.path.desc}</p>
          <div className="path-steps">
            <PathStep num="1" title={t.path.s1.title} text={t.path.s1.text} active />
            <PathStep num="2" title={t.path.s2.title} text={t.path.s2.text} active />
            <PathStep num="3" title={t.path.s3.title} text={t.path.s3.text} />
            <PathStep num="4" title={t.path.s4.title} text={t.path.s4.text} />
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────── */}
      <section className="pricing-section">
        <div className="pricing-header">
          <h2>{t.pricing.title}</h2>
          <p>{t.pricing.desc}</p>
        </div>
        <div className="pricing-cards">
          <div className="price-card">
            <div className="badge" style={{background: 'var(--border)', color: 'var(--fg)'}}>{t.pricing.monthly.badge}</div>
            <h3>{t.pricing.monthly.title}</h3>
            <div className="price">{t.pricing.monthly.price}<span>{t.pricing.monthly.period}</span></div>
            <p style={{color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '16px'}}>{t.pricing.monthly.text}</p>
            <ul>
              <li><CheckCircle2 size={16} /> {t.pricing.f1}</li>
              <li><CheckCircle2 size={16} /> {t.pricing.f2}</li>
              <li><CheckCircle2 size={16} /> {t.pricing.f3}</li>
              <li><CheckCircle2 size={16} /> {t.pricing.f4}</li>
            </ul>
            <Link to="/demo" className="btn btn-secondary">{t.pricing.cta}</Link>
          </div>
          <div className="price-card plus">
            <div className="badge">{t.pricing.yearly.badge}</div>
            <h3>{t.pricing.yearly.title}</h3>
            <div className="price">{t.pricing.yearly.price}<span>{t.pricing.yearly.period}</span></div>
            <p style={{color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '16px', fontWeight: 'bold'}}>{t.pricing.yearly.text}</p>
            <ul>
              <li><CheckCircle2 size={16} /> {t.pricing.f1}</li>
              <li><CheckCircle2 size={16} /> {t.pricing.f2}</li>
              <li><CheckCircle2 size={16} /> {t.pricing.f3}</li>
              <li><CheckCircle2 size={16} /> {t.pricing.f4}</li>
            </ul>
            <Link to="/demo" className="btn btn-primary">{t.pricing.cta}</Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────── */}
      <section className="faq-section">
        <div className="section-header">
          <h2>{t.faq.title}</h2>
          <p>{t.faq.desc}</p>
        </div>
        <div className="faq-grid">
          <div className="faq-item"><h3>{t.faq.q1.q}</h3><p>{t.faq.q1.a}</p></div>
          <div className="faq-item"><h3>{t.faq.q2.q}</h3><p>{t.faq.q2.a}</p></div>
          <div className="faq-item"><h3>{t.faq.q3.q}</h3><p>{t.faq.q3.a}</p></div>
          <div className="faq-item"><h3>{t.faq.q4.q}</h3><p>{t.faq.q4.a}</p></div>
          <div className="faq-item"><h3>{t.faq.q5.q}</h3><p>{t.faq.q5.a}</p></div>
          <div className="faq-item"><h3>{t.faq.q6.q}</h3><p>{t.faq.q6.a}</p></div>
        </div>
      </section>

      {/* ── About / Mission ─────────────────────────────────────────── */}
      <section className="about-section">
        <div className="about-content">
          <h2>{t.about.title}</h2>
          <p>{t.about.p1}</p>
          <p>{t.about.p2}</p>
          <p style={{color: 'var(--muted)', fontSize: '0.9rem'}}>
            Контакт: <a href="mailto:hello@slovakgo.sk">hello@slovakgo.sk</a>
          </p>
        </div>
      </section>

      {/* ── CTA Footer ──────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="footer-content">
          <h2>{t.footer.title}</h2>
          <p>{t.footer.desc}</p>
          <Link to="/demo" className="btn btn-primary btn-lg">{t.footer.cta}</Link>
          <div className="footer-links">
            <span>© 2026 SlovakGO · <a href="mailto:hello@slovakgo.sk">hello@slovakgo.sk</a></span>
            <div className="socials">
              <Smartphone size={18} />
              <Globe size={18} />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ color, label, title, desc }: { color: string; label: string; title: string; desc: string }) {
  return (
    <div className="f-card">
      <div className="f-card-marker" style={{ color }}>
        <span>●</span> {label}
      </div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}

function PathStep({ num, title, text, active = false }: { num: string; title: string; text: string; active?: boolean }) {
  return (
    <div className={`p-step ${active ? 'active' : ''}`}>
      <div className="p-num">{num}</div>
      <div className="p-info">
        <h4>{title}</h4>
        <p>{text}</p>
      </div>
    </div>
  );
}
