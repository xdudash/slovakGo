# Meta Pixel

Pixel: `1339268801708445`, shared by `www.slovakgo.sk`, `slovakgo.sk` and
`app.slovakgo.sk`. Local development and Vercel previews do not send events to
the production pixel.

The shared runtime is `shared/metaPixel.ts`. Advertising consent is required
before loading Meta's script or sending events. A six-month cookie on
`slovakgo.sk` shares the choice with the app. The Cookie button changes or
revokes the choice. No unconditional noscript beacon is used, since it would
bypass consent. Automatic event/form collection and advanced matching are not
enabled; email, name, passwords and answers are not included in event parameters.

| Event | Trigger |
| --- | --- |
| PageView | Initial page and app route changes; deduplicated against React effect replay |
| CompleteRegistration | Successful email signup or a newly created Google account; once per account/browser |
| ViewContent | Subscription offer actually displayed |
| InitiateCheckout | Stripe creates a new checkout; includes EUR price and a session-based event ID; billing portal visits excluded |
| StartTrial | Authenticated Stripe verification of a completed live subscription checkout/trial; zero monetary value |
| Purchase | Stripe confirms a positive, paid live invoice, with actual amount after discounts and currency |
| DemoStart / DemoComplete | Interactive landing demo starts / finishes |
| RegistrationClick / PlacementClick | Landing CTA clicks; never reported as completed registrations |
| OnboardingComplete / FirstLessonComplete / FreeSectionComplete | Actual app milestones; once per account/browser |

`GET /api/billing/conversions` requires authentication. A supplied checkout
session must belong to the current learner. Test, open and unrelated checkouts
cannot produce purchase events. Returning learners also reconcile their latest
invoice so a trial conversion can be reported on their next visit. Only invoices
paid within the last 24 hours are reported, preventing historical payments from
being presented as new conversions. Purchase deduplication uses the invoice ID;
trial deduplication uses the subscription ID. A bounded local ledger survives
reloads; clearing browser storage can cause a repeat browser event.

This is browser Pixel tracking. Ad blockers, missing consent and users who do not
return after an off-session charge limit delivery. Reliable webhook delivery of
all later charges requires a separate Meta Conversions API integration and its
server access token; it is not enabled or claimed here.

## Validation

Automated tests cover opt-in/revocation, one-time loading, route deduplication,
persistent conversion deduplication, sensitive routes, production hostname
gating, authenticated checkout ownership, trial vs purchase, test-mode exclusion,
discounted invoice amounts and historical invoice exclusion.

After deployment, use Meta Events Manager → Test events / Meta Pixel Helper to
confirm the dataset receives real consented browser traffic. Select the actual
conversion event in the ad set (registration or trial according to the campaign
goal). Installing the Pixel alone does not configure campaign optimization or
guarantee learning; it needs real conversion traffic. Do not fabricate purchases
to populate the dataset.
