const fs = require('fs');
let css = fs.readFileSync('src/styles/globals.css', 'utf-8');
const lines = css.split('\n');

let cutoff = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('.landing-wrap {')) {
    cutoff = i;
    break;
  }
}

if (cutoff !== -1) {
  css = lines.slice(0, cutoff).join('\n');
}

const premiumCSS = `
/* ─────────────────────────────────────────────────────────────────
 * PREMIUM LANDING PAGE STYLES (Redesign)
 * ───────────────────────────────────────────────────────────────── */
.landing-wrap.premium {
  background: var(--bg);
  color: var(--fg);
  font-family: 'Inter', -apple-system, sans-serif;
  overflow-x: hidden;
}

/* Gradients & Text */
.text-gradient {
  background: linear-gradient(135deg, var(--accent) 0%, #b388ff 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.premium-bg {
  background: linear-gradient(180deg, rgba(111, 87, 232, 0.02) 0%, rgba(246, 189, 0, 0.03) 100%);
  border-top: 1px solid rgba(111, 87, 232, 0.05);
  border-bottom: 1px solid rgba(111, 87, 232, 0.05);
}

/* Nav */
.premium-nav {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(33, 25, 70, 0.06);
}
.logo-text {
  font-weight: 850;
  font-size: 1.25rem;
  letter-spacing: -0.02em;
}
@media (max-width: 600px) {
  .nav-hide-mobile { display: none; }
}

/* Hero Section */
.premium-hero {
  position: relative;
  padding: 80px 20px 100px;
  overflow: hidden;
}
.hero-bg-glow {
  position: absolute;
  top: -20%;
  left: 50%;
  transform: translateX(-50%);
  width: 800px;
  height: 800px;
  background: radial-gradient(circle, rgba(111, 87, 232, 0.08) 0%, rgba(255, 255, 255, 0) 70%);
  z-index: -1;
  pointer-events: none;
}
.hero-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: center;
}
.hero-badge-wrap {
  margin-bottom: 24px;
}
.glass-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(246, 189, 0, 0.1);
  color: var(--yellow-dark);
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  font-size: 0.9rem;
  font-weight: 700;
  border: 1px solid rgba(246, 189, 0, 0.2);
}
.hero-content h1 {
  font-size: clamp(2.5rem, 5vw, 4rem);
  line-height: 1.1;
  font-weight: 850;
  letter-spacing: -0.03em;
  margin-bottom: 24px;
}
.hero-desc {
  font-size: 1.2rem;
  color: var(--muted);
  line-height: 1.6;
  margin-bottom: 40px;
  max-width: 500px;
}
.hero-cta-group {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.btn-glow {
  box-shadow: 0 12px 24px rgba(111, 87, 232, 0.25);
  transition: transform 0.2s, box-shadow 0.2s;
}
.btn-glow:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 32px rgba(111, 87, 232, 0.35);
}
.trust-stars {
  font-weight: 700;
  font-size: 0.95rem;
  margin-bottom: 8px;
}
.trust-faces {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.9rem;
  color: var(--muted);
}
.trust-faces .mini-avatars img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid #fff;
  margin-left: -10px;
}
.trust-faces .mini-avatars img:first-child { margin-left: 0; }

.premium-mockup {
  position: relative;
  max-width: 320px;
  margin: 0 auto;
}
.mockup-float-card {
  position: absolute;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
  padding: 12px 20px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  box-shadow: 0 12px 32px rgba(33, 25, 70, 0.12);
  border: 1px solid rgba(255,255,255,0.5);
  animation: float 6s ease-in-out infinite;
}
.mockup-float-card.card-1 {
  top: 40px;
  right: -40px;
  animation-delay: 0s;
}
.mockup-float-card.card-2 {
  bottom: 80px;
  left: -50px;
  animation-delay: 3s;
}

@keyframes float {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
}

@media (max-width: 900px) {
  .hero-inner { grid-template-columns: 1fr; text-align: center; }
  .hero-desc { margin: 0 auto 40px; }
  .hero-cta-group { align-items: center; }
  .mockup-float-card.card-1 { right: -10px; }
  .mockup-float-card.card-2 { left: -10px; }
}

/* Logo Cloud */
.logo-cloud-section {
  padding: 40px 20px;
  text-align: center;
  border-top: 1px solid rgba(0,0,0,0.05);
  background: #faf9ff;
}
.cloud-title {
  font-size: 0.9rem;
  color: var(--muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 24px;
}
.logo-cloud {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 40px;
  opacity: 0.6;
  filter: grayscale(100%);
  transition: opacity 0.3s, filter 0.3s;
}
.logo-cloud:hover {
  opacity: 1;
  filter: grayscale(0%);
}
.fake-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.25rem;
  font-weight: 850;
  color: var(--fg);
}

/* Bento Grid */
.bento-section {
  padding: 100px 20px;
  max-width: 1200px;
  margin: 0 auto;
}
.bento-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-top: 40px;
}
.bento-card {
  background: #fff;
  border-radius: 24px;
  padding: 32px;
  box-shadow: 0 4px 20px rgba(33, 25, 70, 0.04);
  border: 1px solid rgba(0,0,0,0.04);
  transition: transform 0.2s;
  color: #120e23;
}
.bento-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(33, 25, 70, 0.08);
}
.bento-card.span-2 { grid-column: span 2; }
.bento-card.span-1 { grid-column: span 1; }
@media (max-width: 900px) {
  .bento-grid { grid-template-columns: 1fr; }
  .bento-card.span-2, .bento-card.span-1 { grid-column: span 1; }
}

/* Glass Table */
.glass-table {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,0.8);
  box-shadow: 0 20px 40px rgba(33,25,70,0.08);
  border-radius: 24px;
  overflow: hidden;
  color: #120e23;
}
.tag {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 700;
}
.tag.green { background: #e7fff2; color: var(--success); }
.tag.yellow { background: #fff8d8; color: var(--yellow-dark); }

/* Testimonials */
.testimonials-section {
  padding: 100px 20px;
  max-width: 1200px;
  margin: 0 auto;
}
.testimonials-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  margin-top: 40px;
}
.testimonial-card {
  background: #fff;
  padding: 32px;
  border-radius: 24px;
  box-shadow: 0 4px 24px rgba(33,25,70,0.06);
  position: relative;
  color: #120e23;
}
.quote-icon {
  margin-bottom: 16px;
  opacity: 0.5;
}
.testimonial-text {
  font-size: 1.1rem;
  line-height: 1.6;
  margin-bottom: 24px;
  color: #120e23;
}
.testimonial-author {
  display: flex;
  align-items: center;
  gap: 16px;
}
.testimonial-author img {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}
.testimonial-author h4 {
  font-weight: 700;
  margin: 0;
}
.testimonial-author span {
  font-size: 0.9rem;
  color: #65607f;
}

/* Pricing Overrides */
.price-card.plus-premium {
  background: linear-gradient(135deg, #fff 0%, #f3f1ff 100%);
  border: 2px solid var(--accent);
  transform: scale(1.05);
}
.price-card.plus-premium .badge.popular {
  background: var(--accent);
  color: #fff;
}
.price-desc.highlight {
  color: var(--accent);
  font-weight: 800;
}
@media (max-width: 900px) {
  .price-card.plus-premium { transform: scale(1); }
}

/* Blog Section */
.blog-section {
  padding: 100px 20px;
}
.blog-grid {
  max-width: 1200px;
  margin: 40px auto 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}
.blog-card {
  background: #fff;
  border-radius: 20px;
  overflow: hidden;
  text-decoration: none;
  color: #120e23;
  box-shadow: 0 4px 20px rgba(0,0,0,0.05);
  transition: transform 0.2s;
  display: flex;
  flex-direction: column;
}
.blog-card:hover {
  transform: translateY(-5px);
}
.blog-img {
  height: 200px;
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
  font-size: 0.8rem;
  font-weight: 700;
  margin-bottom: 12px;
  width: fit-content;
}
.blog-content h3 {
  font-size: 1.2rem;
  line-height: 1.4;
  margin-bottom: 16px;
  flex: 1;
}
.blog-readmore {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--accent);
  font-weight: 700;
  font-size: 0.9rem;
}
.blog-cta {
  text-align: center;
  margin-top: 40px;
}

/* Accordion FAQ */
.faq-accordion {
  max-width: 800px;
  margin: 40px auto 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.faq-item {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
  border: 1px solid rgba(0,0,0,0.03);
  overflow: hidden;
}
.faq-question {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  color: #120e23;
}
.faq-question h3 {
  font-size: 1.1rem;
  margin: 0;
  padding-right: 20px;
}
.faq-icon {
  color: #65607f;
  transition: transform 0.3s;
}
.faq-item.open .faq-icon {
  transform: rotate(180deg);
}
.faq-answer {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease-out;
  padding: 0 24px;
  color: #65607f;
  line-height: 1.6;
}
.faq-item.open .faq-answer {
  max-height: 300px;
  padding: 0 24px 24px;
}

/* Premium Footer */
.premium-footer {
  background: var(--bg-card);
  padding: 80px 20px 40px;
  text-align: center;
  border-top: 1px solid rgba(0,0,0,0.05);
}
.footer-main {
  max-width: 600px;
  margin: 0 auto 60px;
}
.footer-main h2 {
  font-size: 2.5rem;
  margin-bottom: 20px;
}
.footer-main p {
  color: var(--muted);
  font-size: 1.1rem;
  margin-bottom: 32px;
}
.footer-bottom {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 40px;
  border-top: 1px solid rgba(0,0,0,0.05);
}
.footer-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 850;
  font-size: 1.2rem;
}
@media (max-width: 700px) {
  .footer-bottom {
    flex-direction: column;
    gap: 24px;
  }
}
`;

fs.writeFileSync('src/styles/globals.css', css + '\n' + premiumCSS);
