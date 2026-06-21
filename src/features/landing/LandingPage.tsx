import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Globe, Heart, MessageSquare, Smartphone, Zap } from "lucide-react";
import { useAppStore, selectCurrentUser } from "../../store/useAppStore";
import "../../styles/globals.css";

export function LandingPage() {
  const { data, currentUserId } = useAppStore();
  const user = selectCurrentUser(data, currentUserId);

  // Advanced JSON-LD Graph for Hyper-Local Entity SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "@id": "https://www.slovakgo.sk/#app",
        "name": "SlovakGO",
        "applicationCategory": "EducationApplication",
        "operatingSystem": "Web, Android, iOS",
        "inLanguage": ["uk", "sk", "en"],
        "description": "Adaptive language learning for Ukrainians in Slovakia.",
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "EUR" }
      },
      {
        "@type": "Organization",
        "@id": "https://www.slovakgo.sk/#organization",
        "name": "SlovakGO",
        "url": "https://www.slovakgo.sk/",
        "logo": "https://www.slovakgo.sk/favicon.svg",
        "sameAs": [
          "https://www.facebook.com/slovakgo",
          "https://www.instagram.com/slovakgo"
        ],
        "contactPoint": {
          "@type": "ContactPoint",
          "email": "hello@slovakgo.sk",
          "contactType": "customer support",
          "availableLanguage": ["Ukrainian", "Slovak"]
        }
      },
      {
        "@type": "Service",
        "serviceType": "Language Integration",
        "provider": { "@id": "https://www.slovakgo.sk/#organization" },
        "areaServed": [
          { "@type": "City", "name": "Bratislava", "sameAs": "https://www.wikidata.org/wiki/Q1780" },
          { "@type": "City", "name": "Košice", "sameAs": "https://www.wikidata.org/wiki/Q1892" },
          { "@type": "City", "name": "Nitra", "sameAs": "https://www.wikidata.org/wiki/Q133318" },
          { "@type": "City", "name": "Trnava", "sameAs": "https://www.wikidata.org/wiki/Q26159" }
        ],
        "hasOfferCatalog": {
          "@type": "OfferCatalog",
          "name": "Slovak Language Courses",
          "itemListElement": [
            { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "A1 Level Course" } },
            { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Medical Slovak" } },
            { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Employment Slovak" } }
          ]
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
            <div className="logo-icon-sm">SL</div>
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
        <div className="hero-content">
          <div className="hero-badge">
            <Zap size={14} fill="var(--yellow)" />
            <span>Новий підхід до словацької</span>
          </div>
          <h1>Вивчай словацьку через <span>реальні ситуації</span></h1>
          <p>
            Додаток для українців у Словаччині. Від алфавіту до вільного спілкування 
            в аптеці, на пошті чи під час пошуку житла.
          </p>
          <div className="hero-cta">
            <Link to="/register" className="btn btn-primary btn-lg">
              Почати вчити <ArrowRight size={20} />
            </Link>
            <div className="hero-stats">
              <div className="mini-avatars">
                <div className="avatar-m" style={{background: '#fecaca'}}>О</div>
                <div className="avatar-m" style={{background: '#fed7aa'}}>М</div>
                <div className="avatar-m" style={{background: '#bbf7d0'}}>А</div>
              </div>
              <span>Вже з нами 500+ студентів</span>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="phone-mockup">
            <div className="mockup-screen">
              <img src="/slovakgo-preview.png" alt="App Preview" />
            </div>
          </div>
        </div>
      </header>

      {/* ── Features Grid ───────────────────────────────────────────── */}
      <section className="features-section">
        <div className="section-header">
          <h2>Чому SlovakGO?</h2>
          <p>Ми не просто вчимо слова, ми готуємо тебе до життя в новій країні.</p>
        </div>
        
        <div className="features-grid">
          <FeatureCard 
            icon={<MessageSquare className="icon-p" />} 
            title="Сценарії виживання"
            desc="Уроки за темами: оренда квартири, візит до Cudzinecká polícia, школа чи дитячий садок."
          />
          <FeatureCard 
            icon={<Zap className="icon-y" />} 
            title="Для роботи та документів"
            desc="Підготовка до співбесіди та заповнення заяв у Úrad práce чи соціальну страхову (Sociálna poisťovňa)."
          />
          <FeatureCard 
            icon={<Heart className="icon-r" />} 
            title="Ігрова механіка"
            desc="Збирай XP, тримай серію днів та змагайся в лігах з іншими учнями."
          />
          <FeatureCard 
            icon={<Globe className="icon-b" />} 
            title="Локальний контекст"
            desc="Слова та вирази, які реально використовують словаки, а не книжна мова."
          />
        </div>
      </section>

      {/* ── Learning Path Visual ────────────────────────────────────── */}
      <section className="path-teaser">
        <div className="path-content">
          <div className="label">Твій шлях</div>
          <h2>Від A0 до вільного B2</h2>
          <div className="path-steps">
            <PathStep num="1" title="Старт" text="Алфавіт та вимова" active />
            <PathStep num="2" title="Виживання" text="Магазин, транспорт, житло" active />
            <PathStep num="3" title="Адаптація" text="Робота, лікарі, документи" />
            <PathStep num="4" title="Свобода" text="Дискусії та професійна мова" />
          </div>
        </div>
      </section>

      {/* ── Subscription / Pricing Preview ──────────────────────────── */}
      <section className="pricing-section">
        <div className="pricing-header">
          <h2>Доступно для кожного</h2>
          <p>Вчися безкоштовно або отримай максимум з Plus-версією.</p>
        </div>
        <div className="pricing-cards">
          <div className="price-card free">
            <h3>Basic</h3>
            <div className="price">€0<span>/міс</span></div>
            <ul>
              <li><CheckCircle2 size={16} /> Всі рівні навчання</li>
              <li><CheckCircle2 size={16} /> Денний ліміт XP</li>
              <li><CheckCircle2 size={16} /> Система серій</li>
            </ul>
            <Link to="/register" className="btn btn-ghost">Спробувати</Link>
          </div>
          
          <div className="price-card plus">
            <div className="badge">Рекомендовано</div>
            <h3>Plus</h3>
            <div className="price">€9.99<span>/міс</span></div>
            <ul>
              <li><CheckCircle2 size={16} /> Безлімітні серця</li>
              <li><CheckCircle2 size={16} /> Відсутність реклами</li>
              <li><CheckCircle2 size={16} /> Офлайн доступ</li>
              <li><CheckCircle2 size={16} /> Розширена аналітика</li>
            </ul>
            <Link to="/register" className="btn btn-primary">Стати Plus</Link>
          </div>
        </div>
      </section>

      {/* ── FAQ Section (SEO/AI Targeted) ─────────────────────────── */}
      <section className="faq-section">
        <div className="section-header">
          <h2>Часті запитання</h2>
        </div>
        <div className="faq-grid">
          <div className="faq-item">
            <h4>Чи підходить додаток для початківців?</h4>
            <p>Так, ми починаємо з рівня A0 (алфавіт та базові фрази). Це ідеально для тих, хто тільки переїхав до Братислави чи інших міст Словаччини.</p>
          </div>
          <div className="faq-item">
            <h4>Чи є в додатку специфічні теми для життя?</h4>
            <p>Ми сфокусовані на реальних потребах: візит до лікаря, спілкування в школі, оренда житла та робочі моменти.</p>
          </div>
          <div className="faq-item">
            <h4>Як працює офлайн режим?</h4>
            <p>Plus-користувачі можуть завантажувати уроки та вчити словацьку навіть без інтернету, наприклад, під час поїздки в потязі Bratislava-Košice.</p>
          </div>
        </div>
      </section>

      {/* ── CTA Footer ──────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="footer-content">
          <h2>Готовий почати розмовляти?</h2>
          <p>Приєднуйся до спільноти українців, які вже вільно почуваються в Словаччині.</p>
          <Link to="/register" className="btn btn-primary btn-lg">Зареєструватися безкоштовно</Link>
          <div className="footer-links">
            <span>© 2026 SlovakGO</span>
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

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="f-card">
      <div className="f-icon">{icon}</div>
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
