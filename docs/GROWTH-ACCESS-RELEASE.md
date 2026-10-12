# Access, users and activity release

Release prepared on 2026-10-12. Vercel access to the `slovak-go` team and the production Turso database `slovak-life` are confirmed. Sensitive Vercel environment values are write-only and export as `[SENSITIVE]`; earlier Stripe 401 and Resend 400 responses came from testing those placeholders and do not establish invalid production credentials. Stripe's live catalog contains the EUR 3/month Price `price_1UJPwF6bLes2FwwHCZ2NzmSe` and EUR 20/year Price `price_1UJPwn6bLes2FwwHkXOjwl2Z`. Production provider checks must use the deployed server, which receives the real secrets.

Targets supplied by the owner:
- App: Vercel `slovak-go/slovak-go`, https://app.slovakgo.sk
- Landing: Vercel `slovak-go/slovak-go-mmzg`, https://www.slovakgo.sk

## Behavior

- The free allowance is 10 distinct lessons per account, across topic boundaries. The starting level is frozen when onboarding finishes. If that level has fewer than ten lessons, the catalog continues into the next level. Changing the profile level cannot grant a second free catalog. Completed free lessons can be repeated.
- A one-lesson topic no longer triggers the paywall. After ten completions the trial offer appears. Registration, completion and opening the offer never start a trial. A checkout request requires explicit acceptance; Stripe confirms activation after the learner completes checkout. Trial length is three days, once per account.
- Both catalog endpoints return metadata only for protected lessons. Theory, vocabulary, exercises and scenarios are omitted. Completion/practice mutations enforce access on the server. Parallel completions use optimistic concurrency and cannot spend the final free slot twice.
- Monthly checkout validates the configured Stripe Price against EUR 300 cents/month. An incorrect configured price blocks checkout instead of charging an unexpected amount. The existing yearly option remains EUR 20/year and is validated separately. Changing display text does not change existing Stripe subscriptions or prices.
- User search, subscription/activity/progress filters and pagination run in SQL. CSV streams every matching account in batches of 500; this is a batch size, not an export limit. There are separate full inactive and marketing-consented inactive exports. Inactive means no recorded activity for seven days, with practice/registration fallback for legacy accounts. CSV includes consent/block flags and protects spreadsheet formula cells.
- Activity starts counting only after interaction, while visible and focused. After 60 seconds without interaction, time stops counting. After five minutes, the session closes; returning creates a new one. Heartbeats use cumulative seconds for idempotency, cap duration against server time and close abandoned sessions on subsequent server access. Visits count page sessions and returns to a visible/focused page. Data starts accumulating after deployment; historical active time cannot be reconstructed.
- Marketing consent is optional and unchecked at registration. Existing accounts without explicit consent are excluded. Settings allow opt-in/out. Lifecycle emails have signed unsubscribe links and one-click headers; GET shows confirmation and POST opts out. Billing/security messages are separate.
- Email attempts store the Resend message ID and `accepted` or failure status. `accepted` is not proof of delivery. Admin dashboard diagnostics read actual provider delivery events and recent cron results. A Resend key restricted to sending may be unable to read events; inspect the provider dashboard in that case. Diagnostics send no emails.

## Production rollout

1. Authenticate a Vercel account with access to the supplied team; link the app project explicitly. Keep production secrets in a gitignored `.env.production.local`, never in chat or commits. Do not run local browser tests against the production database.
2. Retrieve the configured `STRIPE_PRICE_ID` using the real Stripe account. Confirm it is active, EUR, 300 cents, licensed/per-unit, recurring monthly with interval_count=1. If incorrect, create a new EUR 3 monthly Price for the same product and update the production variable; do not assume old subscriptions change. Check `STRIPE_PRICE_ID_YEARLY` separately if keeping that option.
3. Verify `RESEND_API_KEY`, a verified `MAIL_FROM`, `APP_URL=https://app.slovakgo.sk`, `JWT_SECRET`, and `CRON_SECRET`. Never infer working delivery merely from a configured key.
4. Back up the database, load the intended production environment explicitly, and run `npm run migrate -- --schema-only`. Changes are additive; no historical progress or user records are removed. Existing accounts are not opted into marketing.
5. Deploy the app and landing projects from the reviewed source. Check that the landing project's root directory is `landing`.
6. In the admin dashboard use “Перевірити Stripe та пошту”. Confirm the actual prices, provider delivery statuses and a completed daily lifecycle run. Verify a consenting test account receives a lifecycle email and that opting out stops marketing. Use only an authorized test recipient.
7. In Stripe test mode, verify checkout/cancel/webhook activation, the three-day trial, the EUR 3 renewal, cancellation and returning subscribers. Do not make a real charge as a smoke test.

## Validation

- `npm test`: API integration tests use isolated SQLite and mocked external providers, including >500-record CSV export, expired access, consent/unsubscribe, lifecycle deduplication, activity caps/idle expiry and parallel final-slot claims.
- `npm run build`, `npx tsc --noEmit -p api/tsconfig.json`, `npm run lint`.
- `npm run build --prefix landing`.
- Local browser check with disposable data: registration → onboarding → first lesson → next topic; a short A0 level continues into A1; after ten completions the trial offer appears with `subscriptionStatus=free` and `trialEndsAt=null`. Admin filters and session details render.

Relevant API references: [Stripe Prices](https://docs.stripe.com/api/prices), [Resend email retrieval](https://resend.com/docs/api-reference/emails/retrieve-email).

## Released on 2026-10-12

- Production database `slovak-life` backed up before schema migration. Migration was rehearsed on a copy and applied in a transaction with no reminder/settings backfill. Comparing all original columns and rows against the backup confirmed preservation of all 44 users and 740 lessons.
- Production configuration now uses the verified EUR 3 monthly and EUR 20 yearly prices, `APP_URL=https://app.slovakgo.sk`, and a generated sensitive `CRON_SECRET`.
- Vercel runtime packaging required `shared/package.json` with CommonJS scope to match the existing API compilation. The first failed isolated build was not promoted. The corrected API deployment passed runtime checks.
- App deployment: `dpl_2HNUBeFrorsiBhw3zLXnniaX38am`, https://slovak-gxg2oice2-slovak-go.vercel.app, promoted to https://app.slovakgo.sk.
- Landing deployment: `dpl_4cVy79BQn2UcdTK3k4LCqRFuf7S7`, https://slovak-go-mmzg-3ecwgsdwf-slovak-go.vercel.app, promoted to https://www.slovakgo.sk.
- Runtime checks: Premium login and all 740 lessons; new free registration with consent off; onboarding exposes 10 full lessons and 730 metadata-only lessons; ten completions succeed; an eleventh completion is rejected; user remains free with no trial expiry; activity writes; admin search/detail and complete CSV export.
- Stripe monthly and yearly Checkout sessions were created successfully without completing checkout or making a payment. The server verified real price amounts/currency/interval. Trial activation and webhook delivery were covered by automated tests, not by a live payment.
- Provider diagnostics authenticated successfully to Resend. There were no historical delivery records returned; actual email delivery was not tested and no emails were sent as part of rollout. Consent is required for lifecycle messages; previous accounts remain opted out unless they choose otherwise.
- A disposable release account was used for functional checks and briefly granted admin solely for read-only provider/export diagnostics, then revoked and deleted. Its analytics were removed. The permanent test Premium account remains available. Final database counts are 44 users and 740 lessons.
- Validation: 198 tests in 15 files pass; API type check, ESLint, app build, landing build, diff whitespace checks pass. Landing browser QA covered all four languages at 320px plus Ukrainian at 390px and desktop, with no horizontal overflow.
