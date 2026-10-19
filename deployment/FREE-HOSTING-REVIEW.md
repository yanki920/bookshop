# Free hosting review — 20 October 2026

## Recommendation

For a no-fixed-hosting-fee starting point, adapt the app to **Cloudflare Pages/Workers + Supabase Free**. Workers still open one private website; the two providers are implementation details. This is a recommendation for a migration, not an already deployable or deployed replacement. Do not proceed with the paid Render blueprint while the owner is considering this route.

The existing Node/SQLite/Docker package is verified, but does not run unchanged on either Cloudflare or static Netlify hosting. The free path requires real application work, not a different deploy button. Commercial shop use is not assumed to include paid-plan support, an uptime guarantee, automatic backups or unlimited storage.

## Verified published allowances and restrictions

Official documentation was fetched from the providers' own public GitHub repositories. Direct pricing-site access was blocked by this environment's proxy. Website checkout/account-specific terms, tax, special offers and plan changes are not independently verified; recheck the account's displayed terms before activating anything paid.

| Candidate | Published limits relevant to this app | Assessment |
| --- | --- | --- |
| Cloudflare Pages/Workers Free + Supabase Free | Cloudflare Workers: 100,000 dynamic requests/day, 10 ms CPU/invocation; static-asset requests free/unlimited. Pages: 500 builds/month, 25 MiB/asset. Supabase: 500 MB database/project, 1 GB object storage, 5 GB egress, 50,000 monthly active users, 200 peak realtime connections, 2 million realtime messages. | Recommended free starting route after migration and realistic load/device tests. Supabase provides managed accounts and private file storage, reducing the need to build an authentication system for a 10 ms edge runtime. |
| Cloudflare Workers + D1 | D1 Free: 5 million rows read/day, 100,000 written/day, 500 MB/database, 5 GB/account, seven-day Time Travel; maximum row/blob 2 MB. Workers CPU limits still apply. | Possible alternative, but not a direct SQLite swap: current invoice JSON can exceed 2 MB and Node password hashing/Python OCR do not fit unchanged. Needs an authentication solution plus separate file storage. Not the simplest first migration. |
| Prepared Render package | `render.yaml` explicitly requests a paid Starter Docker service and persistent disk. Current provider checkout prices were not accessible. | Lowest-change route for the existing Node/SQLite app, but not the zero-fee route the owner requested. Keep on hold; nothing has been deployed. |
| Netlify | Its current pricing page was blocked. No current Netlify credit/usage figures verified. Static frontend hosting by itself does not run the current persistent Node/SQLite server. | A possible alternative frontend provider with an external backend, not a free unchanged deployment. No reason established to switch the recommendation back to Netlify. |

Supabase explicitly says Free projects with low activity in a seven-day period **may be paused**; this is not a promise of continuous production availability. Its documentation recommends free-tier users regularly export their data and keep off-site backups. Downloadable managed daily backups are not a Free-plan entitlement. These limitations matter for a busy shop and holiday closures.

## Changes required before the free version can be called ready

1. Keep the existing RTL interface, order types, phone-first search, manual status changes and delivery chain.
2. Replace local `node:sqlite` storage with Supabase Postgres tables and atomic, version-checked transactions for invoice/allocation/order/task updates. Reuse pure delivery-chain logic, but test it on the target runtime.
3. Use Supabase Auth for private owner/worker sessions. Apply row-level access policies for staff tasks/conversations and private files. Do not expose service credentials, Gmail tokens or shop passwords in frontend assets.
4. Store invoice PDFs and damage photos in private object storage rather than embedding base64 files in every invoice JSON/list response. Fetch them on demand.
5. Replace full-data polling with realtime/incremental updates and indexed, limited searches. At five devices, eight hours/day, twenty days/month, polling every fifteen seconds produces 192,000 polling cycles. Even only 50 KB transferred per cycle is about 9.6 GB/month, above Supabase's published 5 GB Free egress allowance. The current whole-document approach cannot simply be moved and promised free indefinitely.
6. Reuse the tested browser PDF/Hebrew/English OCR reader, or choose a separately priced server OCR service. Python OCR cannot run unchanged in a free Worker. Test browser OCR performance on the actual shop tablet; desktop browser tests alone do not prove every tablet/invoice format works.
7. Create and rehearse independent backups of both database and private files. A database export alone does not preserve stored file contents. A protected external backup destination and permissions still need choosing; this review does not claim backup automation exists for Supabase.
8. Test shared records on two independent sessions/devices, staff privacy, invoice matching, partial receipts, notifications' saved preferences, data retention and realistic usage before using real shop records. Preserve/export existing trial data before any migration; no data has been moved by this review.

Free hosting does not authorise Gmail or make SMS/WhatsApp free. Supplier-email automation and actual notification sending still need their own implementation, account consent and provider configuration. Erply remains read-only; no external account or record was changed during this review.

## Official sources retrieved

- Cloudflare Workers pricing: https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/workers/platform/pricing.mdx
- Cloudflare Pages limits: https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/pages/platform/limits.mdx
- Cloudflare D1 limits: https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/d1/platform/limits.mdx
- Cloudflare D1 pricing table: https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/partials/workers/d1-pricing.mdx
- Supabase allowances: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/platform/billing-on-supabase.mdx
- Supabase inactivity/production guidance: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/deployment/going-into-prod.mdx
- Supabase backups: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/platform/backups.mdx
