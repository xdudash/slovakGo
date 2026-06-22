import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE_URL = 'https://www.slovakgo.sk';
const TODAY    = new Date().toISOString().slice(0, 10);

// ── Pages list ────────────────────────────────────────────────────────────────
// Add new blog articles here. Fields:
//   path       — URL path, e.g. '/blog/my-article'
//   priority   — 0.0–1.0 (homepage = 1.0, blog index = 0.8, articles = 0.7)
//   changefreq — always | hourly | daily | weekly | monthly | yearly | never
//   hreflang   — set true to emit uk/sk/x-default alternate links
//   image      — optional { loc, title } for image sitemap extension
const PAGES = [
  // ── Homepage ────────────────────────────────────────────────────────────────
  {
    path: '/',
    priority: '1.0',
    changefreq: 'weekly',
    hreflang: true,
    image: {
      loc: `${BASE_URL}/slovakgo-preview.png`,
      title: 'SlovakGO — додаток для вивчення словацької мови для українців',
    },
  },

  // ── Auth ────────────────────────────────────────────────────────────────────
  { path: '/register', priority: '0.8', changefreq: 'monthly' },
  { path: '/login',    priority: '0.4', changefreq: 'monthly' },

  // ── App (onboarding / public-facing shell) ──────────────────────────────────
  { path: '/app', priority: '0.5', changefreq: 'monthly' },

  // ── Blog index ──────────────────────────────────────────────────────────────
  { path: '/blog', priority: '0.8', changefreq: 'weekly' },

  // ── Blog articles ────────────────────────────────────────────────────────────
  // Add new articles below. Keep slug kebab-case in Ukrainian transliteration.
  {
    path: '/blog/yak-vyvchaты-slovatsku-z-nulya',
    priority: '0.7',
    changefreq: 'monthly',
  },
  {
    path: '/blog/slovatska-vs-ukrainska-shcho-spilnoho',
    priority: '0.7',
    changefreq: 'monthly',
  },
  {
    path: '/blog/riven-movы-dlya-roboty-v-slovachchyni',
    priority: '0.7',
    changefreq: 'monthly',
  },
];

// ── XML builder ───────────────────────────────────────────────────────────────
function urlEntry(page) {
  const abs = `${BASE_URL}${page.path}`;
  let e = `  <url>\n    <loc>${abs}</loc>\n`;

  if (page.hreflang) {
    const skPath = page.path === '/' ? '/sk' : `/sk${page.path}`;
    e += `    <xhtml:link rel="alternate" hreflang="uk"      href="${abs}" />\n`;
    e += `    <xhtml:link rel="alternate" hreflang="sk"      href="${BASE_URL}${skPath}" />\n`;
    e += `    <xhtml:link rel="alternate" hreflang="x-default" href="${abs}" />\n`;
  }

  e += `    <lastmod>${TODAY}</lastmod>\n`;
  e += `    <changefreq>${page.changefreq}</changefreq>\n`;
  e += `    <priority>${page.priority}</priority>\n`;

  if (page.image) {
    e += `    <image:image>\n`;
    e += `      <image:loc>${page.image.loc}</image:loc>\n`;
    e += `      <image:title>${page.image.title}</image:title>\n`;
    e += `    </image:image>\n`;
  }

  return e + `  </url>`;
}

const xml = [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"`,
  `        xmlns:xhtml="http://www.w3.org/1999/xhtml"`,
  `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`,
  ``,
  PAGES.map(urlEntry).join('\n\n'),
  ``,
  `</urlset>`,
].join('\n');

const out = resolve(__dirname, 'public/sitemap.xml');
writeFileSync(out, xml, 'utf-8');
console.log(`✓  sitemap.xml → ${out}`);
console.log(`   ${PAGES.length} URLs · lastmod ${TODAY}`);
