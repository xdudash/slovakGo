const fs = require('fs');

let css = fs.readFileSync('src/styles/globals.css', 'utf-8');
const lines = css.split('\n');

let cutoff = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('.landing-wrap {') || lines[i].includes('PREMIUM LANDING PAGE STYLES')) {
    cutoff = i;
    break;
  }
}

if (cutoff !== -1) {
  css = lines.slice(0, cutoff).join('\n');
}

const completeLandingCSS = `
/* ─────────────────────────────────────────────────────────────────
 * COMPLETE & ALIGNED PREMIUM LANDING PAGE STYLES
 * ───────────────────────────────────────────────────────────────── */
.landing-wrap.premium {
  background: var(--bg);
  color: var(--fg);
  font-family: 'Rubik', system-ui, -apple-system, sans-serif;
  overflow-x: hidden;
}

/* Gradients & Text */
.text-gradient {
  background: linear-gradient(135deg, var(--accent) 0%, #8b5cf6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.premium-bg {
  background: linear-gradient(180deg, rgba(111, 87, 232, 0.03) 0%, rgba(246, 189, 0, 0.02) 100%);
  border-top: 1px solid rgba(111, 87, 232, 0.06);
  border-bottom: 1px solid rgba(111, 87, 232, 0.06);
}

/* Nav */
.premium-nav {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(33, 25, 70, 0.06);
}
.nav-container {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
}
.landing-logo {
  display: flex;
  align-items: center;
  gap: 10px;
}
.logo-icon-sm {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  object-fit: contain;
}
.logo-text {
  font-weight: 850;
  font-size: 1.3rem;
  letter-spacing: -0.02em;
  color: var(--fg);
}
.nav-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}
.nav-lang-switcher {
  display: flex;
  gap: 4px;
  background: #f0f0f5;
  padding: 3px;
  border-radius: 8px;
}
.nav-lang-btn {
  background: transparent;
  border: none;
  padding: 4px 10px;
  font-size: 0.8rem;
  font-weight: 700;
  border-radius: 6px;
  cursor: pointer;
  color: var(--muted);
  transition: all 0.2s;
}
.nav-lang-btn.active {
  background: #fff;
  color: var(--accent);
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
}
.nav-link {
  font-weight: 600;
  color: var(--fg);
  font-size: 0.95rem;
  padding: 6px 12px;
}

/* Common Section Header */
.section-header {
  text-align: center;
  max-width: 720px;
  margin: 0 auto 48px auto;
}
.section-header h2 {
  font-size: 2.3rem;
  font-weight: 850;
  color: var(--fg);
  margin-bottom: 12px;
  letter-spacing: -0.02em;
}
.section-header p {
  font-size: 1.05rem;
  color: var(--muted);
  line-height: 1.6;
}

/* Hero Section */
.premium-hero {
  position: relative;
  padding: 70px 20px 90px;
  overflow: hidden;
}
.hero-bg-glow {
  position: absolute;
  top: -30%;
  left: 50%;
  transform: translateX(-50%);
  width: 900px;
  height: 900px;
  background: radial-gradient(circle, rgba(111, 87, 232, 0.1) 0%, rgba(255, 255, 255, 0) 70%);
  z-index: -1;
  pointer-events: none;
}
.hero-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 50px;
  align-items: center;
}
.hero-badge-wrap {
  margin-bottom: 20px;
}
.glass-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(246, 189, 0, 0.12);
  color: var(--yellow-dark);
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  font-size: 0.88rem;
  font-weight: 750;
  border: 1px solid rgba(246, 189, 0, 0.25);
}
.hero-content h1 {
  font-size: clamp(2.4rem, 4.5vw, 3.6rem);
  line-height: 1.12;
  font-weight: 850;
  letter-spacing: -0.03em;
  margin-bottom: 20px;
  color: var(--fg);
}
.hero-desc {
  font-size: 1.15rem;
  color: var(--muted);
  line-height: 1.6;
  margin-bottom: 36px;
  max-width: 520px;
}
.hero-cta-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 18px;
}
.btn-glow {
  box-shadow: 0 10px 24px rgba(111, 87, 232, 0.28);
  transition: transform 0.2s, box-shadow 0.2s;
}
.btn-glow:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 30px rgba(111, 87, 232, 0.38);
}
.trust-stars {
  font-weight: 700;
  font-size: 0.92rem;
  margin-bottom: 6px;
  color: var(--fg);
}
.trust-faces {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.88rem;
  color: var(--muted);
}
.trust-faces .mini-avatars img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid #fff;
  margin-left: -8px;
  object-fit: cover;
}
.trust-faces .mini-avatars img:first-child { margin-left: 0; }

.hero-mockup-wrap {
  display: flex;
  justify-content: center;
}
.premium-mockup {
  position: relative;
  max-width: 300px;
  width: 100%;
}
.mockup-float-card {
  position: absolute;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  padding: 10px 18px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 750;
  font-size: 0.9rem;
  color: var(--fg);
  box-shadow: 0 10px 28px rgba(33, 25, 70, 0.12);
  border: 1px solid rgba(255,255,255,0.7);
  z-index: 2;
}
.mockup-float-card.card-1 {
  top: 30px;
  right: -30px;
}
.mockup-float-card.card-2 {
  bottom: 40px;
  left: -40px;
}

/* Logo Cloud */
.logo-cloud-section {
  padding: 36px 20px;
  text-align: center;
  border-top: 1px solid rgba(0,0,0,0.04);
  background: #faf9ff;
}
.cloud-title {
  font-size: 0.85rem;
  color: var(--muted);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 20px;
}
.logo-cloud {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 36px;
  opacity: 0.7;
}
.fake-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--fg);
}

/* Bento Grid */
.bento-section {
  padding: 80px 20px;
  max-width: 1140px;
  margin: 0 auto;
}
.bento-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
.bento-card {
  background: #fff;
  border-radius: 20px;
  padding: 28px;
  box-shadow: 0 4px 20px rgba(33, 25, 70, 0.04);
  border: 1px solid rgba(0,0,0,0.05);
  transition: transform 0.2s, box-shadow 0.2s;
  color: var(--fg);
}
.bento-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 30px rgba(33, 25, 70, 0.08);
}
.bento-card.span-2 { grid-column: span 2; }
.bento-card.span-1 { grid-column: span 1; }
.f-card-marker {
  font-size: 0.85rem;
  font-weight: 750;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 12px;
}
.bento-card h3 {
  font-size: 1.3rem;
  font-weight: 800;
  margin-bottom: 10px;
  color: var(--fg);
}
.bento-card p {
  color: var(--muted);
  font-size: 0.98rem;
  line-height: 1.5;
  margin: 0;
}

/* Comparison Table Section */
.comparison-section {
  padding: 80px 20px;
  max-width: 1000px;
  margin: 0 auto;
}
.table-wrap {
  margin-top: 32px;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 4px 24px rgba(33, 25, 70, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.05);
  overflow-x: auto;
  padding: 8px;
}
.glass-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}
.glass-table th {
  padding: 16px 20px;
  color: var(--muted);
  font-weight: 750;
  font-size: 0.9rem;
  border-bottom: 2px solid #f0f0f5;
  width: 33.33%;
}
.glass-table td {
  padding: 16px 20px;
  color: var(--fg);
  font-weight: 600;
  font-size: 0.98rem;
  border-bottom: 1px solid #f5f5fa;
  width: 33.33%;
}
.tag {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 750;
}
.tag.green { background: #e7fff2; color: #16a34a; }
.tag.yellow { background: #fff8d8; color: #b45309; }

/* Testimonials */
.testimonials-section {
  padding: 80px 20px;
  max-width: 1140px;
  margin: 0 auto;
}
.testimonials-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}
.testimonial-card {
  background: #fff;
  padding: 28px;
  border-radius: 20px;
  box-shadow: 0 4px 20px rgba(33,25,70,0.05);
  border: 1px solid rgba(0,0,0,0.04);
  color: var(--fg);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.quote-icon {
  margin-bottom: 12px;
  color: var(--accent);
  opacity: 0.6;
}
.testimonial-text {
  font-size: 1.02rem;
  line-height: 1.6;
  margin-bottom: 20px;
  color: var(--fg);
}
.testimonial-author {
  display: flex;
  align-items: center;
  gap: 14px;
}
.testimonial-author img {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
}
.testimonial-author h4 {
  font-weight: 750;
  font-size: 0.98rem;
  margin: 0;
  color: var(--fg);
}
.testimonial-author span {
  font-size: 0.85rem;
  color: var(--muted);
}

/* CEFR Path Section */
.path-section {
  padding: 80px 20px;
  max-width: 880px;
  margin: 0 auto;
}
.path-container {
  text-align: center;
}
.label-badge {
  display: inline-block;
  font-size: 0.85rem;
  font-weight: 750;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}
.path-container h2 {
  font-size: 2.3rem;
  font-weight: 850;
  margin-bottom: 12px;
  color: var(--fg);
}
.path-desc {
  color: var(--muted);
  font-size: 1.05rem;
  margin-bottom: 36px;
}
.path-steps {
  display: flex;
  flex-direction: column;
  gap: 16px;
  text-align: left;
}
.p-step {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  padding: 20px 24px;
  background: #fff;
  border-radius: 18px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
}
.p-step.active {
  border-color: rgba(111, 87, 232, 0.3);
  background: linear-gradient(135deg, #ffffff 0%, #faf8ff 100%);
}
.p-num {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #f0ebff;
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  font-weight: 850;
  flex-shrink: 0;
}
.p-info h4 {
  font-size: 1.12rem;
  font-weight: 750;
  margin: 0 0 6px 0;
  color: var(--fg);
}
.p-info p {
  font-size: 0.95rem;
  color: var(--muted);
  margin: 0;
  line-height: 1.5;
}

/* Pricing Section */
.pricing-section {
  padding: 80px 20px;
  max-width: 980px;
  margin: 0 auto;
  text-align: center;
}
.pricing-header h2 {
  font-size: 2.3rem;
  font-weight: 850;
  margin-bottom: 10px;
  color: var(--fg);
}
.pricing-header p {
  color: var(--muted);
  font-size: 1.05rem;
  margin-bottom: 44px;
}
.pricing-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 28px;
  align-items: stretch;
}
.price-card {
  background: #fff;
  border-radius: 24px;
  padding: 36px 30px;
  text-align: left;
  box-shadow: 0 4px 24px rgba(33, 25, 70, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.06);
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.price-card .badge {
  position: absolute;
  top: -13px;
  left: 30px;
  background: #f0f0f5;
  color: var(--muted);
  padding: 4px 14px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 750;
}
.price-card.plus-premium {
  border: 2px solid var(--accent);
  background: linear-gradient(135deg, #ffffff 0%, #f7f4ff 100%);
  box-shadow: 0 10px 32px rgba(111, 87, 232, 0.15);
}
.price-card.plus-premium .badge.popular {
  background: var(--accent);
  color: #ffffff;
}
.price-card h3 {
  font-size: 1.35rem;
  font-weight: 800;
  margin: 8px 0 8px 0;
  color: var(--fg);
}
.price-card .price {
  font-size: 2.6rem;
  font-weight: 850;
  color: var(--fg);
  line-height: 1;
  margin-bottom: 8px;
}
.price-card .price span {
  font-size: 0.95rem;
  color: var(--muted);
  font-weight: 500;
}
.price-card .price-desc {
  font-size: 0.92rem;
  color: var(--muted);
  margin-bottom: 24px;
}
.price-card .price-desc.highlight {
  color: var(--accent);
  font-weight: 750;
}
.price-card ul.price-features {
  list-style: none !important;
  padding: 0 !important;
  margin: 0 0 28px 0 !important;
}
.price-card ul.price-features li {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  font-size: 0.92rem;
  color: var(--fg);
}
.price-card ul.price-features li svg {
  color: var(--success);
  flex-shrink: 0;
}
.price-card .btn {
  width: 100%;
  justify-content: center;
}

/* Blog Section */
.blog-section {
  padding: 80px 20px;
}
.blog-grid {
  max-width: 1140px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}
.blog-card {
  background: #fff;
  border-radius: 20px;
  overflow: hidden;
  text-decoration: none;
  color: var(--fg);
  box-shadow: 0 4px 20px rgba(0,0,0,0.04);
  border: 1px solid rgba(0,0,0,0.04);
  transition: transform 0.2s;
  display: flex;
  flex-direction: column;
}
.blog-card:hover {
  transform: translateY(-4px);
}
.blog-img {
  height: 190px;
  background-size: cover;
  background-position: center;
}
.blog-content {
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.blog-tag {
  display: inline-block;
  padding: 4px 10px;
  background: #f3f1ff;
  color: var(--accent);
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 750;
  margin-bottom: 12px;
  width: fit-content;
}
.blog-content h3 {
  font-size: 1.15rem;
  font-weight: 750;
  line-height: 1.4;
  margin-bottom: 16px;
  flex: 1;
  color: var(--fg);
}
.blog-readmore {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--accent);
  font-weight: 750;
  font-size: 0.88rem;
}
.blog-cta {
  text-align: center;
  margin-top: 36px;
}

/* Accordion FAQ */
.faq-section {
  padding: 80px 20px;
}
.faq-accordion {
  max-width: 780px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.faq-item {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.03);
  border: 1px solid rgba(0,0,0,0.05);
  overflow: hidden;
}
.faq-question {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  color: var(--fg);
}
.faq-question h3 {
  font-size: 1.05rem;
  font-weight: 750;
  margin: 0;
  padding-right: 16px;
  color: var(--fg);
}
.faq-icon {
  color: var(--muted);
  transition: transform 0.3s;
  flex-shrink: 0;
}
.faq-item.open .faq-icon {
  transform: rotate(180deg);
}
.faq-answer {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease-out;
  padding: 0 24px;
  color: var(--muted);
  line-height: 1.6;
  font-size: 0.95rem;
}
.faq-item.open .faq-answer {
  max-height: 300px;
  padding: 0 24px 20px;
}

/* Premium Footer */
.premium-footer {
  background: #fff;
  padding: 70px 20px 36px;
  text-align: center;
  border-top: 1px solid rgba(0,0,0,0.06);
}
.footer-main {
  max-width: 580px;
  margin: 0 auto 50px;
}
.footer-main h2 {
  font-size: 2.2rem;
  font-weight: 850;
  margin-bottom: 16px;
  color: var(--fg);
}
.footer-main p {
  color: var(--muted);
  font-size: 1.05rem;
  margin-bottom: 28px;
}
.footer-bottom {
  max-width: 1140px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 32px;
  border-top: 1px solid rgba(0,0,0,0.05);
}
.footer-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 850;
  font-size: 1.15rem;
  color: var(--fg);
}

/* Media Queries for Mobile Responsiveness */
@media (max-width: 900px) {
  .hero-inner {
    grid-template-columns: 1fr;
    text-align: center;
    gap: 40px;
  }
  .hero-desc {
    margin: 0 auto 32px;
  }
  .hero-cta-group {
    align-items: center;
  }
  .mockup-float-card.card-1 { right: 0; }
  .mockup-float-card.card-2 { left: 0; }
  .bento-grid {
    grid-template-columns: 1fr;
  }
  .bento-card.span-2, .bento-card.span-1 {
    grid-column: span 1;
  }
}

@media (max-width: 640px) {
  .nav-container {
    padding: 12px 16px;
  }
  .nav-hide-mobile {
    display: none;
  }
  .hero-content h1 {
    font-size: 2.1rem;
  }
  .pricing-cards {
    grid-template-columns: 1fr;
  }
  .p-step {
    flex-direction: row;
    padding: 16px;
    gap: 14px;
  }
  .p-num {
    width: 36px;
    height: 36px;
    font-size: 0.95rem;
  }
  .glass-table th, .glass-table td {
    padding: 12px 10px;
    font-size: 0.85rem;
  }
  .footer-bottom {
    flex-direction: column;
    gap: 20px;
  }
}
`;

fs.writeFileSync('src/styles/globals.css', css + '\n' + completeLandingCSS);
console.log("Successfully rebuilt globals.css with matched styles!");
