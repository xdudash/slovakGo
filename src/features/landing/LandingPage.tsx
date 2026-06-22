import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Globe, Smartphone, Zap } from "lucide-react";
import { useAppStore, selectCurrentUser } from "../../store/useAppStore";
import "../../styles/globals.css";

export function LandingPage() {
  const { data, currentUserId } = useAppStore();
  const user = selectCurrentUser(data, currentUserId);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://www.slovakgo.sk/#website",
        "url": "https://www.slovakgo.sk/",
        "name": "SlovakGO",
        "inLanguage": "uk",
        "potentialAction": {
          "@type": "SearchAction",
          "target": "https://www.slovakgo.sk/?s={search_term_string}",
          "query-input": "required name=search_term_string"
        }
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://www.slovakgo.sk/#app",
        "name": "SlovakGO",
        "applicationCategory": "EducationApplication",
        "operatingSystem": "Web, Android, iOS",
        "inLanguage": ["uk", "sk", "en"],
        "description": "SlovakGO is a free Slovak language learning app for Ukrainian speakers living in Slovakia. It teaches practical vocabulary for daily life scenarios: renting apartments, visiting doctors, navigating the Cudzinecká polícia (Foreigners' Police), and applying for jobs.",
        "datePublished": "2026-01-01",
        "dateModified": "2026-06-22",
        "offers": {
          "@type": "AggregateOffer",
          "lowPrice": "0",
          "highPrice": "9.99",
          "priceCurrency": "EUR",
          "offerCount": "2"
        },
        "provider": { "@id": "https://www.slovakgo.sk/#organization" }
      },
      {
        "@type": "Organization",
        "@id": "https://www.slovakgo.sk/#organization",
        "name": "SlovakGO",
        "url": "https://www.slovakgo.sk/",
        "logo": "https://www.slovakgo.sk/logosk.jpg",
        "foundingDate": "2026",
        "description": "SlovakGO helps Ukrainian speakers adapt to life in Slovakia through short, practical Slovak language lessons.",
        "areaServed": { "@type": "Country", "name": "Slovakia" },
        "sameAs": [
          "https://www.facebook.com/slovakgo",
          "https://www.instagram.com/slovakgo"
        ],
        "contactPoint": {
          "@type": "ContactPoint",
          "email": "hello@slovakgo.sk",
          "contactType": "customer support",
          "availableLanguage": ["Ukrainian", "Slovak", "English"]
        }
      },
      {
        "@type": "Service",
        "serviceType": "Slovak Language Learning for Ukrainians",
        "name": "SlovakGO Language Courses",
        "description": "Online Slovak language courses designed for Ukrainian speakers in Slovakia, covering CEFR levels A0 through B2.",
        "provider": { "@id": "https://www.slovakgo.sk/#organization" },
        "areaServed": [
          { "@type": "City", "name": "Bratislava", "sameAs": "https://www.wikidata.org/wiki/Q1780" },
          { "@type": "City", "name": "Košice", "sameAs": "https://www.wikidata.org/wiki/Q1892" },
          { "@type": "City", "name": "Nitra", "sameAs": "https://www.wikidata.org/wiki/Q133318" },
          { "@type": "City", "name": "Trnava", "sameAs": "https://www.wikidata.org/wiki/Q26159" },
          { "@type": "City", "name": "Prešov", "sameAs": "https://www.wikidata.org/wiki/Q131560" },
          { "@type": "City", "name": "Žilina", "sameAs": "https://www.wikidata.org/wiki/Q131514" }
        ],
        "hasOfferCatalog": {
          "@type": "OfferCatalog",
          "name": "Slovak Language Courses",
          "itemListElement": [
            { "@type": "Offer", "itemOffered": { "@type": "Course", "name": "A1 Survival Slovak", "description": "Basic phrases for daily survival in Slovakia" } },
            { "@type": "Offer", "itemOffered": { "@type": "Course", "name": "Medical Slovak", "description": "Vocabulary for doctor visits, pharmacy, and emergencies" } },
            { "@type": "Offer", "itemOffered": { "@type": "Course", "name": "Employment Slovak", "description": "Job interview prep and workplace communication" } },
            { "@type": "Offer", "itemOffered": { "@type": "Course", "name": "Housing Slovak", "description": "Renting apartments, contracts, and talking to landlords" } }
          ]
        }
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "Скільки часу потрібно, щоб вивчити базову словацьку мову?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Більшість учнів досягають рівня A2 (виживання) за 3–4 місяці при 15 хвилинах щоденних занять. Оскільки словацька та українська мають спільні слов'янські корені, українськомовні учні засвоюють словацьку приблизно на 30% швидше, ніж носії романських чи германських мов."
            }
          },
          {
            "@type": "Question",
            "name": "Чи схожа словацька на українську?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Так, обидві мови належать до слов'янської групи та мають спільну базову лексику. Слова як 'вода' (voda), 'хліб' (chlieb), 'місто' (mesto) легко впізнаються. Основні відмінності — у вимові, порядку слів та деяких граматичних формах. Для українця словацька є однією з найлегших іноземних мов."
            }
          },
          {
            "@type": "Question",
            "name": "Який рівень словацької потрібен для роботи в Словаччині?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Для більшості робочих місць достатньо рівня B1 за шкалою CEFR (Загальноєвропейські рекомендації з мовної освіти). Для роботи з клієнтами або в офісі потрібен B2. Базовий A2 дозволяє порозумітися у повсякденних ситуаціях — магазин, транспорт, колеги на виробництві."
            }
          },
          {
            "@type": "Question",
            "name": "Як безкоштовно вивчити словацьку онлайн?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "SlovakGO пропонує безкоштовний базовий план з доступом до всіх рівнів навчання від A0 до B2. Щоденні короткі уроки (10–15 хвилин) доступні без оплати. Безкоштовний план включає систему серій та XP-прогресію. Платний план Plus (€9.99/міс) додає офлайн доступ та безлімітні серця."
            }
          },
          {
            "@type": "Question",
            "name": "Чи потрібне знання словацької для отримання тимчасового проживання?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Для отримання тимчасового проживання (prechodný pobyt) базове знання словацької не є обов'язковим, але суттєво допомагає при спілкуванні з Cudzinecká polícia (Відділом у справах іноземців). Для постійного проживання (trvalý pobyt) після 5 років може знадобитися іспит на рівень A2."
            }
          },
          {
            "@type": "Question",
            "name": "Як зареєструватися в Словаччині як іноземець?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Для реєстрації потрібно звернутися до Cudzinecká polícia (Відділу у справах іноземців) за місцем проживання. Потрібні: паспорт, договір оренди житла, заповнена анкета та фото. SlovakGO має спеціальний урок з лексикою для цього процесу, включаючи типові запитання офіцерів та правильні відповіді."
            }
          }
        ]
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
            <img src="/logosk.jpg" alt="SlovakGO логотип" className="logo-icon-sm" />
            <span>SlovakGO</span>
          </div>
          <div className="nav-actions">
            {user ? (
              <Link to="/app" className="btn btn-secondary btn-sm">Перейти в додаток</Link>
            ) : (
              <>
                <Link to="/login" className="nav-link">Увійти</Link>
                <Link to="/register" className="btn btn-primary btn-sm">Почати безкоштовно</Link>
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
              <span>Для українців у Словаччині</span>
            </div>
            <h1>Вивчай словацьку через <span>реальні ситуації</span></h1>
            <p>
              SlovakGO — безкоштовний додаток словацької мови (Slovenčina) для українців.
              Від нуля до впевненої розмови в аптеці, на роботі й у лікаря —
              за 15 хвилин на день.
            </p>
            <div className="hero-cta">
              <Link to="/register" className="btn btn-primary btn-lg">
                Почати безкоштовно <ArrowRight size={18} />
              </Link>
              <div className="hero-stats">
                <div className="mini-avatars">
                  <div className="avatar-m" style={{background: '#fecaca'}}>О</div>
                  <div className="avatar-m" style={{background: '#a5f3fc'}}>М</div>
                  <div className="avatar-m" style={{background: '#bbf7d0'}}>А</div>
                </div>
                <span>500+ українців вже з нами</span>
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
          <h2>Чому SlovakGO вчить словацьку швидше</h2>
          <p>
            Стандартні курси вчать граматику у відриві від реального життя.
            SlovakGO — кожен урок навколо конкретної ситуації,
            з якою стикається кожен українець у перші місяці в Словаччині.
          </p>
        </div>
        <div className="features-grid">
          <FeatureCard
            color="var(--accent)"
            label="Виживання"
            title="Сценарії з реального життя"
            desc="Оренда квартири, Cudzinecká polícia, школа — вчиш саме те, що потрібно вже завтра, а не абстрактну граматику."
          />
          <FeatureCard
            color="var(--yellow-dark)"
            label="Кар'єра"
            title="Робота та документи"
            desc="Співбесіда, Úrad práce, Sociálna poisťovňa — реальні фрази для реальних українських ситуацій у Словаччині."
          />
          <FeatureCard
            color="var(--success)"
            label="Прогрес"
            title="XP, серії та ліги"
            desc="Збирай бали, тримай серію — середня серія учнів SlovakGO 12 днів. Щоденна звичка формується за 2 тижні."
          />
          <FeatureCard
            color="var(--blue)"
            label="Контекст"
            title="Жива розмовна мова"
            desc="Слова які реально вживають у Bratislava, Košice, Prešov — не книжна норма, а те що почуєш на вулиці."
          />
        </div>
      </section>

      {/* ── Slovak vs Ukrainian ─────────────────────────────────────── */}
      <section className="advantage-section">
        <div className="section-header">
          <h2>Словацька та українська — ближче, ніж ти думаєш</h2>
          <p>
            Обидві мови належать до слов'янської групи та мають спільні корені.
            Близько 30–40% базової лексики словацької (Slovenčina) впізнається
            українськомовним читачем без жодної підготовки.
          </p>
        </div>
        <div className="comparison-table">
          <table>
            <thead>
              <tr>
                <th>Українська (Українська)</th>
                <th>Словацька (Slovenčina)</th>
                <th>Різниця</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>вода</td><td>voda</td><td>однакова</td></tr>
              <tr><td>місто</td><td>mesto</td><td>майже однакова</td></tr>
              <tr><td>хліб</td><td>chlieb</td><td>схожа</td></tr>
              <tr><td>добрий</td><td>dobrý</td><td>схожа</td></tr>
              <tr><td>мати</td><td>mať</td><td>однакова</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Learning Path ───────────────────────────────────────────── */}
      <section className="path-teaser">
        <div className="path-content">
          <div className="label">Твій шлях за рівнями CEFR</div>
          <h2>Від A0 до вільного B2 за словацькою мовою</h2>
          <p style={{marginBottom: '24px', color: 'var(--muted)', fontSize: '0.95rem'}}>
            CEFR (Загальноєвропейські рекомендації з мовної освіти) — міжнародна шкала рівнів
            знання мови від A1 (початковий) до C2 (досконалий).
          </p>
          <div className="path-steps">
            <PathStep num="1" title="A0–A1: Старт" text="Алфавіт, вимова, базові фрази для виживання. Більшість учнів проходять за 3–4 тижні." active />
            <PathStep num="2" title="A2: Виживання" text="Магазин, транспорт, оренда житла. Достатньо для щоденного життя. Ціль — 2–3 місяці." active />
            <PathStep num="3" title="B1: Адаптація" text="Робота, лікарі, документи в Cudzinecká polícia. Потрібно для більшості робочих місць." />
            <PathStep num="4" title="B2: Свобода" text="Вільні дискусії, професійна лексика, переговори. Відкриває офісні та управлінські позиції." />
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────── */}
      <section className="pricing-section">
        <div className="pricing-header">
          <h2>Безкоштовне вивчення словацької — без кредитної картки</h2>
          <p>SlovakGO безкоштовний для всіх рівнів від A0 до B2. Plus-план для тих, хто хоче більше.</p>
        </div>
        <div className="pricing-cards">
          <div className="price-card free">
            <h3>Basic — Безкоштовно</h3>
            <div className="price">€0<span>/міс</span></div>
            <ul>
              <li><CheckCircle2 size={16} /> Всі рівні A0–B2</li>
              <li><CheckCircle2 size={16} /> 50+ уроків з реальних ситуацій</li>
              <li><CheckCircle2 size={16} /> Система XP та серій</li>
              <li><CheckCircle2 size={16} /> Таблиця лідерів</li>
            </ul>
            <Link to="/register" className="btn btn-ghost">Спробувати безкоштовно</Link>
          </div>

          <div className="price-card plus">
            <div className="badge">Рекомендовано</div>
            <h3>Plus — €9.99/міс</h3>
            <div className="price">€9.99<span>/міс</span></div>
            <ul>
              <li><CheckCircle2 size={16} /> Безлімітні серця</li>
              <li><CheckCircle2 size={16} /> Офлайн доступ до уроків</li>
              <li><CheckCircle2 size={16} /> Розширена аналітика прогресу</li>
              <li><CheckCircle2 size={16} /> Пріоритетна підтримка</li>
            </ul>
            <Link to="/register" className="btn btn-primary">Стати Plus</Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────── */}
      <section className="faq-section">
        <div className="section-header">
          <h2>Часті запитання про вивчення словацької</h2>
          <p>Відповіді на найпопулярніші питання від українців у Словаччині.</p>
        </div>
        <div className="faq-grid">
          <div className="faq-item">
            <h3>Скільки часу займає вивчення словацької з нуля?</h3>
            <p>
              Більшість учнів досягають рівня <strong>A2 (базове виживання)</strong> за 3–4 місяці
              при заняттях 15 хвилин на день. Для рівня <strong>B1 (робочий рівень)</strong>
              потрібно приблизно 6–9 місяців. Українськомовним учням легше — спільна слов'янська
              база прискорює засвоєння лексики.
            </p>
          </div>
          <div className="faq-item">
            <h3>Чи схожа словацька мова на українську?</h3>
            <p>
              Так — обидві є слов'янськими мовами та мають спільну базову лексику. Такі слова
              як <em>voda</em> (вода), <em>mesto</em> (місто), <em>dobrý</em> (добрий)
              українці розуміють без перекладу. Основна складність — вимова та деякі
              граматичні форми. Загалом словацька є однією з найлегших мов для українців.
            </p>
          </div>
          <div className="faq-item">
            <h3>Який рівень словацької потрібен для роботи у Словаччині?</h3>
            <p>
              Для більшості виробничих та сервісних позицій достатньо рівня <strong>A2–B1</strong>.
              Для офісної роботи або позицій з клієнтами потрібен <strong>B2</strong>.
              Úrad práce (Центр зайнятості) може запропонувати безкоштовні курси для зареєстрованих
              шукачів роботи.
            </p>
          </div>
          <div className="faq-item">
            <h3>Як зареєструватися в Словаччині як громадянин України?</h3>
            <p>
              Потрібно звернутися до <strong>Cudzinecká polícia</strong> (Відділу у справах
              іноземців — аналог УДМС) за місцем проживання. Необхідні: паспорт, договір
              оренди або лист від роботодавця, заповнена анкета. SlovakGO має спеціальний урок
              з лексикою та типовими питаннями для цього процесу.
            </p>
          </div>
          <div className="faq-item">
            <h3>Чи можна вчити словацьку без інтернету?</h3>
            <p>
              Так — користувачі SlovakGO Plus можуть завантажувати уроки для офлайн вивчення.
              Це зручно під час поїздок потягом Bratislava–Košice або в районах зі слабким
              сигналом. Прогрес синхронізується автоматично при появі інтернету.
            </p>
          </div>
          <div className="faq-item">
            <h3>Чи потрібна словацька для медичного обслуговування?</h3>
            <p>
              Більшість лікарів у великих містах Словаччини розуміють базову англійську або
              російську, проте знання словацьких медичних термінів суттєво пришвидшує візит.
              SlovakGO містить окремий урок <strong>"У лікаря"</strong> з фразами для опису
              симптомів, розуміння діагнозу та рецепту в аптеці (lekáreň).
            </p>
          </div>
        </div>
      </section>

      {/* ── About / Mission ─────────────────────────────────────────── */}
      <section className="about-section">
        <div className="about-content">
          <h2>Про SlovakGO</h2>
          <p>
            SlovakGO створений щоб допомогти українцям швидко адаптуватися до життя у Словаччині
            через мову. Кожен урок побудований на реальних сценаріях, які збирали безпосередньо
            від українців у <strong>Братиславі (Bratislava — столиці Словаччини)</strong>,
            Кошице (Košice), Пряшеві (Prešov) та інших містах.
          </p>
          <p>
            Наш підхід: <strong>10–15 хвилин на день</strong> замість годинних лекцій.
            Уроки охоплюють рівні від <strong>A0 до B2 за шкалою CEFR</strong> — від першого
            слова до вільної розмови. Додаток доступний у браузері, на Android та iOS як PWA.
          </p>
          <p style={{color: 'var(--muted)', fontSize: '0.9rem'}}>
            Контакт: <a href="mailto:hello@slovakgo.sk">hello@slovakgo.sk</a>
          </p>
        </div>
      </section>

      {/* ── CTA Footer ──────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="footer-content">
          <h2>Готовий почати розмовляти словацькою?</h2>
          <p>
            Приєднуйся до 500+ українців, які вже вивчають словацьку через SlovakGO
            і впевнено почуваються в Братиславі, Кошице та інших містах Словаччини.
          </p>
          <Link to="/register" className="btn btn-primary btn-lg">Зареєструватися безкоштовно</Link>
          <div className="footer-links">
            <span>© 2026 SlovakGO · <a href="mailto:hello@slovakgo.sk">hello@slovakgo.sk</a></span>
            <span style={{color: 'var(--muted)', fontSize: '0.8rem'}}>Оновлено: Червень 2026</span>
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
