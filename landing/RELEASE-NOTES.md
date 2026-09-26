# Landing conversion update

## Delivered
- Responsive landing and static UK/RU/EN/SK pages, including complete no-JavaScript content.
- A1–C2 learning path, suitability, level selection guidance, learning expectations, eight objections, transparent trial/renewal/cancellation copy and support.
- Small A1 example with feedback and a registration continuation; no invented social proof or scarcity.
- Monthly offer is primary; approved display prices are EUR 3/month and EUR 20/year.
- Language is passed into registration; registration no longer promises unearned demo XP.
- Displayed subscription prices and monthly button priority aligned in the app.

## Verification
- `npm run build --prefix landing`: successful, including four static locales.
- `npm run build`: successful.
- `npm test -- src/i18n.test.ts`: 3 tests passed.
- DOM checks: four languages, populated copy, internal anchors, app language handoff links, wrong/right response, reset on language selection, sticky CTA suppression at hero/footer.
- Browser visual review could not be completed in this environment.

## Required before production release
Verify the live Stripe prices referenced by STRIPE_PRICE_ID and STRIPE_PRICE_ID_YEARLY are EUR 3/month and EUR 20/year. Backend price IDs were not changed or queried. Display prices alone do not change checkout amounts. Perform a test checkout and cancellation without a real charge, then review mobile layouts at 320, 390 and 430px.

## Scope
No production deployment. Existing learning content and billing lifecycle code are unchanged.
