---
description: Full technical SEO audit — scans meta tags, hreflang, structured data, OG tags, sitemap, robots.txt, image alt text, heading hierarchy, and page speed signals. Reports every issue with a ready-to-apply fix.
allowed-tools: Read, Bash, Edit, Write, WebFetch
---

# /seo — Full Technical SEO Audit & Fix

You are an expert technical SEO engineer. When invoked, perform a complete SEO audit of this project and fix every issue you find. Work methodically through all layers below. Never skip a section. After fixing, summarize what changed.

---

## LAYER 1 — Meta & Head (`index.html`)

Read `index.html`. Check and fix:

1. **Title tag**
   - Must be 50–60 characters, include primary keyword near the front
   - Must NOT be generic ("Home", "Welcome", "App")
   - Pattern: `Primary Keyword — Brand Name | Secondary Keyword`

2. **Meta description**
   - Must be 145–160 characters
   - Must contain primary keyword + clear value proposition + implicit CTA
   - No duplicate of the title

3. **Canonical tag**
   - `<link rel="canonical" href="https://www.domain.com/" />` must be present in `<head>`

4. **Hreflang tags**
   - Every hreflang must have a matching `x-default`
   - URLs must be absolute and end with `/`
   - Each language variant must point to the correct locale URL
   - Check: `uk-SK`, `uk-UA`, `sk-SK`, `x-default`

5. **Robots meta**
   - Should NOT have `noindex` or `nofollow` unless intentional
   - Add `<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />` if missing

6. **Open Graph tags** — check all 8 required:
   - `og:type`, `og:url`, `og:title`, `og:description`, `og:image`, `og:image:width`, `og:image:height`, `og:site_name`
   - `og:image` must be absolute URL, at least 1200×630px

7. **Twitter Card tags**
   - `twitter:card` must be `summary_large_image`
   - `twitter:site` should have @handle if available

8. **Theme color & viewport**
   - `<meta name="viewport" content="width=device-width, initial-scale=1.0" />` ✓
   - `<meta name="theme-color" content="..." />` ✓

---

## LAYER 2 — Structured Data (JSON-LD)

Read the landing page component. Inspect the `<script type="application/ld+json">` block.

Check and fix:

1. **@graph structure** — preferred over multiple scripts
2. **Organization** node must include:
   - `@id`, `name`, `url`, `logo` (absolute URL), `sameAs` array, `contactPoint`
3. **SoftwareApplication** node must include:
   - `applicationCategory: "EducationApplication"`
   - `operatingSystem`, `offers` with price, `aggregateRating` (add if reviews exist)
4. **WebSite** node — add if missing:
   ```json
   {
     "@type": "WebSite",
     "@id": "https://www.domain.com/#website",
     "url": "https://www.domain.com/",
     "name": "Brand Name",
     "potentialAction": {
       "@type": "SearchAction",
       "target": "https://www.domain.com/search?q={search_term_string}",
       "query-input": "required name=search_term_string"
     }
   }
   ```
5. **BreadcrumbList** — add to inner pages if they exist
6. **FAQ** — add to landing page if FAQ section exists:
   ```json
   { "@type": "FAQPage", "mainEntity": [{ "@type": "Question", "name": "...", "acceptedAnswer": { "@type": "Answer", "text": "..." } }] }
   ```

Validate: no `undefined` values, no relative URLs, no missing required fields.

---

## LAYER 3 — Sitemap & Robots

Check if `public/sitemap.xml` exists. If not, create it:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://www.domain.com/</loc>
    <xhtml:link rel="alternate" hreflang="uk" href="https://www.domain.com/" />
    <xhtml:link rel="alternate" hreflang="sk" href="https://www.domain.com/sk" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://www.domain.com/" />
    <lastmod>YYYY-MM-DD</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

Check if `public/robots.txt` exists. If not, create it:
```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /app/

Sitemap: https://www.domain.com/sitemap.xml
```

Replace `domain.com` with the actual domain from `APP_URL` in `.env.local` or `index.html`.

---

## LAYER 4 — Landing Page Content

Read the landing page component. Check:

1. **H1 tag** — exactly one, contains primary keyword, above the fold
2. **H2/H3 hierarchy** — must be sequential, no skipping levels
3. **Keyword density** — primary keyword appears naturally 2–4 times in body copy
4. **Image alt text** — every `<img>` must have descriptive `alt` (not empty, not "image", not filename)
5. **Internal links** — at least 2 internal links from landing to key app sections
6. **External links** — authoritative outbound links should have `rel="noopener noreferrer"`
7. **Word count** — landing page body should have at least 300 words of visible text
8. **CTA clarity** — primary CTA button text must be action-oriented ("Start Learning", not "Submit")

---

## LAYER 5 — Performance Signals

Check `index.html` and `src/styles/globals.css`:

1. **Font loading** — if Google Fonts used, add `rel="preconnect"` and `rel="preload"`
2. **Critical CSS** — check if above-the-fold styles are inlined or loaded efficiently
3. **Image formats** — flag any `.jpg`/`.png` larger than 200KB that should be `.webp`
4. **Lazy loading** — non-hero images should have `loading="lazy"`
5. **Preload hints** — add for LCP image:
   ```html
   <link rel="preload" as="image" href="/hero-image.webp" />
   ```

---

## LAYER 6 — PWA & Mobile SEO

Check `public/manifest.webmanifest`:
1. `name`, `short_name`, `start_url`, `display: "standalone"`, `theme_color`, `background_color`
2. At least one icon ≥192×192, one ≥512×512

Check `index.html`:
1. `<link rel="apple-touch-icon">` present
2. `<meta name="theme-color">` present
3. Viewport meta correct

---

## OUTPUT FORMAT

After completing the audit, output a table:

| Layer | Check | Status | Fix Applied |
|-------|-------|--------|-------------|
| Meta | Title length | ❌ 72 chars | Shortened to 58 chars |
| Meta | Canonical | ✅ | — |
| Structured Data | WebSite node | ❌ Missing | Added WebSite + SearchAction |
| ... | ... | ... | ... |

Then: **"X issues found, Y fixed automatically, Z require manual action"**

For anything requiring manual action (e.g. getting real review counts for AggregateRating), list exactly what data is needed.
