---
description: GEO (Generative Engine Optimization) — optimizes content to be cited and surfaced by AI search engines (Perplexity, ChatGPT Search, Google AI Overviews, Claude). Adds FAQ schema, direct-answer blocks, entity markup, E-E-A-T signals, and conversational query coverage.
allowed-tools: Read, Bash, Edit, Write, WebFetch
---

# /geo — Generative Engine Optimization (GEO)

You are an expert in GEO — the practice of optimizing web content so that AI-powered search engines (Perplexity, ChatGPT Search, Google SGE/AI Overviews, Bing Copilot, Claude.ai) cite, quote, and surface your content in generated answers.

GEO differs from classic SEO: instead of ranking for clicks, you are training AI models to trust and reproduce your content as answers. The goal is to be the **cited source** in AI-generated responses.

Work through all layers below. Read existing content first, then apply fixes. Never invent facts — only restructure and annotate real content.

---

## LAYER 1 — Direct Answer Blocks

AI models prefer content that answers questions directly in the first 2 sentences of a section. Scan the landing page and all content pages.

For each section heading that is a question or implies one, ensure the **first paragraph answers it completely in 1–3 sentences** before elaborating.

Pattern to apply:
```
BAD:
## Learning Slovak for Ukrainians
Our app was designed with the unique needs of Ukrainian speakers in mind. We spent months 
researching the most common challenges...

GOOD:
## Learning Slovak for Ukrainians
SlovakGO teaches practical Slovak to Ukrainians living in Slovakia through short daily lessons
built around real-life scenarios like renting an apartment, visiting a doctor, or applying for work.
Our curriculum was designed specifically for Ukrainian speakers, who share some grammatical 
patterns with Slovak but face distinct pronunciation challenges.
```

Apply this pattern to every major section on the landing page.

---

## LAYER 2 — FAQ Schema & Content

Read the landing page. Check if a FAQ section exists. If not, add one with at least 6 questions that real users ask AI engines about this product/topic.

Research what questions to include by thinking about:
- What would someone type into Perplexity about learning Slovak?
- What does a Ukrainian in Slovakia Google about language learning?
- What questions appear in "People also ask" for this niche?

For a language-learning app for Ukrainians in Slovakia, good FAQ questions include:
- "How long does it take to learn Slovak?"
- "Is Slovak similar to Ukrainian?"
- "What level of Slovak do I need to work in Slovakia?"
- "How can I learn Slovak for free online?"
- "What documents require Slovak language knowledge in Slovakia?"

Write clear, factual 2–4 sentence answers for each. Then add FAQ schema to the structured data:

```json
{
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How long does it take to learn basic Slovak?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Most learners reach A2 (survival) level in 3–4 months with 15 minutes of daily practice. Slovak shares vocabulary roots with Ukrainian, which gives Ukrainian speakers a measurable advantage — reducing the time to functional fluency by roughly 30% compared to English speakers."
      }
    }
  ]
}
```

Add the FAQ section visually to the page AND in the JSON-LD structured data block.

---

## LAYER 3 — Named Entity Optimization

AI engines build knowledge graphs. Your content must clearly define and link the key entities it is about.

Read all content files. For each core entity mentioned, ensure:

1. **App/Product entity** — full name used at least once per page, not just pronouns
2. **Geographic entities** — city/country names linked or annotated:
   - "Bratislava (Slovakia's capital)" on first mention
   - "Košice", "Prešov", "Žilina" used in context
3. **Language entities** — "Slovak language (Slovenčina)", "Ukrainian language (Українська)"
4. **Institution entities** — "Cudzinecká polícia (Foreigners' Police)", "Sociálna poisťovňa (Social Insurance Agency)" — always include Slovak official name + translation in parentheses
5. **Skill/level entities** — "A1, A2, B1, B2" CEFR levels explained inline on first use

In the landing page component, scan for entities and add parenthetical translations/explanations on first mention. This makes your content more likely to be used as a factual reference.

---

## LAYER 4 — E-E-A-T Signals (Experience, Expertise, Authoritativeness, Trustworthiness)

AI models weight sources with strong E-E-A-T signals. Check and add:

1. **Author/Creator signal** — add to Organization structured data:
   ```json
   "founder": { "@type": "Person", "name": "Founder Name", "jobTitle": "Founder" }
   ```

2. **Trust signals on landing page** — add if missing:
   - User count ("500+ active learners")
   - Lessons count ("50+ lessons across 6 topics")
   - Country context ("Built for Ukrainians in Slovakia")
   - Any press mentions or partnerships

3. **About/mission statement** — add a brief paragraph explaining WHO built this and WHY. AI models cite sources that demonstrate first-hand experience:
   ```
   SlovakGO was built by [team/founders] to help Ukrainian speakers navigate daily life 
   in Slovakia. Every lesson is based on real scenarios reported by Ukrainians living in 
   Bratislava, Košice, and other Slovak cities.
   ```

4. **Contact/transparency signals** — ensure `contactPoint` in structured data has a real email. AI models flag content from sites with no contact information as lower trust.

5. **Date signals** — add `datePublished` and `dateModified` to structured data for content freshness.

---

## LAYER 5 — Conversational Query Coverage

AI search handles long-tail, conversational queries. Scan the landing page copy and identify gaps. Add content (or a dedicated section) covering these query patterns:

**"How do I..." queries:**
- "How do I say [common phrase] in Slovak?"
- "How do I register at the foreigners' police in Slovakia?"

**"What is..." queries:**
- "What is the difference between Slovak and Ukrainian?"
- "What Slovak words do I need to know for the doctor?"

**"Best..." queries:**
- "Best way to learn Slovak quickly"
- "Best Slovak learning app for Ukrainians"

For each query type, ensure your landing page has at least one paragraph that naturally contains the answer. You do NOT need to create separate pages — the content just needs to exist on the page in a scannable format.

Add a "Common Questions" or "Quick Answers" section if the page lacks conversational coverage.

---

## LAYER 6 — Citation-Worthy Statistics & Claims

AI models prefer to cite pages with specific, verifiable claims. Vague claims are never cited. Audit all copy:

```
BAD (vague, never cited):
"Learn Slovak faster than traditional methods"
"Thousands of users trust us"

GOOD (specific, citable):
"SlovakGO users reach A2 level in an average of 14 weeks with 15 min/day practice"
"512 Ukrainians in Slovakia completed their first lesson in June 2026"
```

Replace vague marketing language with specific, honest, measurable claims. If you don't have real stats yet, use honest ranges: "Most learners complete a lesson in under 10 minutes."

---

## LAYER 7 — Content Freshness Signals

AI search engines weight recently updated content. Ensure:

1. **`dateModified`** in JSON-LD is updated to today's date (or close to it)
2. **`lastmod`** in sitemap.xml is current
3. Add a visible "Last updated: [Month Year]" near the bottom of the landing page — AI models read this as a freshness signal

---

## LAYER 8 — Perplexity & ChatGPT Specific Optimizations

These two engines dominate AI search for informational queries. They prefer:

1. **Numbered and bulleted lists** for procedural content — check that step-by-step content uses `<ol>` not paragraphs
2. **Tables** for comparisons — if comparing learning methods or CEFR levels, format as HTML/JSX table
3. **Short paragraphs** — split any paragraph over 4 sentences into two paragraphs
4. **Definition pattern** — "X is Y. X does Z." pattern on first mention of any technical term
5. **Source-like headings** — headings phrased as statements of fact ("Slovak and Ukrainian Share 30% of Vocabulary") rank better than vague headings ("About Our Language")

Scan the landing page and apply these formatting improvements.

---

## LAYER 9 — robots.txt & Crawler Access

AI engines use their own crawlers. Ensure they are not blocked:

Read `public/robots.txt`. Verify these crawlers are NOT blocked:
- `GPTBot` (OpenAI)
- `PerplexityBot`
- `ClaudeBot` (Anthropic)
- `GoogleExtendedBot` (Google AI)
- `anthropic-ai`

If `robots.txt` blocks `*` and doesn't explicitly allow these bots, add:

```
User-agent: GPTBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: anthropic-ai
Allow: /
```

Do NOT allow crawlers to access `/api/` or `/app/` (authenticated routes).

---

## OUTPUT FORMAT

After completing all layers, output:

### GEO Audit Results

**AI Citation Readiness Score: X/9 layers complete**

| Layer | Action | Status |
|-------|--------|--------|
| Direct Answer Blocks | Rewrote 3 section intros | ✅ Done |
| FAQ Schema | Added 6 Q&As + JSON-LD | ✅ Done |
| Named Entities | Added Slovak official names | ✅ Done |
| E-E-A-T | Added trust stats + contact | ✅ Done |
| Conversational Queries | Added Quick Answers section | ✅ Done |
| Citation-Worthy Claims | Replaced 4 vague claims | ✅ Done |
| Freshness Signals | Updated dateModified | ✅ Done |
| Perplexity Formatting | Split 6 long paragraphs | ✅ Done |
| Crawler Access | Updated robots.txt | ✅ Done |

**Estimated time to first AI citation: 2–6 weeks after indexing**

**Top 3 queries this content is now optimized for:**
1. "best Slovak learning app for Ukrainians"
2. "how to learn Slovak quickly living in Slovakia"
3. "Slovak language app for Ukrainian speakers"
