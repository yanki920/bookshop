# Netlify + Supabase deployment

This is the owner's selected hosting route. The source and local checks are prepared; no Netlify site or Supabase project has been created by this task. Render is on hold. Do not deploy `render.yaml` or replace the original Netlify shop site.

## What runs where

Netlify serves the RTL app and a Node 24 function in `netlify/shop-functions`. Supabase holds shared Postgres records and a private `bookshop-files` bucket. PDFs and pictures upload directly to private Storage through short-lived signed URLs, avoiding Netlify function body limits. Invoice PDF extraction and English/Hebrew OCR run on the worker's browser. Review quantities before saving a checklist. OCR downloads its reader/languages on first use and needs internet access; test on the actual shop tablet.

The static build is an explicit allowlist, not a copy of the repository. It includes no server source, SQL, credentials or local database. The old `netlify/functions/erply.js` is excluded. No Erply account changes or messages are sent by this deployment.

## Account setup (three steps at a time)

1. Create a Supabase project using its Free plan, choosing an EU region. Keep its database password private.
2. In that project's SQL editor, run [202610220001_bookshop.sql](../supabase/migrations/202610220001_bookshop.sql). It is safe to rerun without deleting records. It creates service-only tables/functions and the private file bucket.
3. Create a **new** Netlify project from `yanki920/bookshop`, branch **`codex/trial-preview`**. Netlify reads `netlify.toml`; no manual build-directory changes are needed. Do not switch the existing `dapper-licorice-542a6f` site from main.

Then enter these values in the new Netlify project's secure environment-variable settings, available to Functions. They are not public build variables and must never be pasted into chat or committed:

| Name | Value source |
| --- | --- |
| `SUPABASE_URL` | Project URL, `https://PROJECT.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase legacy **service_role** server key; never the anon/publishable key |
| `BOOKSHOP_ACCESS_PASSWORD` | A unique shop entrance password, at least 12 characters |
| `BOOKSHOP_OWNER_PASSWORD` | A different unique password, 10–200 characters; initial personal username is `manager` |
| `BOOKSHOP_OWNER_NAME` | Optional owner's display name, up to 100 characters |

Redeploy after saving these settings. The first shop sign-in creates one manager and supplier names, **no sample orders**. Enter the shared shop password once per browser session to access orders/deliveries; personal Tasks & Chat sign-in uses each worker's own username/password. The owner creates workers inside Tasks & Chat → Workers & passwords. Credentials use scrypt; opaque personal sessions are stored server-side; shop and personal cookies are HttpOnly and expire after eight hours. Rotating the shared shop password invalidates existing shop access. The owner password setting bootstraps the account once; changing the setting afterward does not reset an existing personal account.

The app refuses to expose business records when required settings are missing. Database RLS denies browser/anonymous access; the server key stays in Netlify Functions. Do not make the Storage bucket public. The original website and SQLite development records are not migrated or deleted automatically. Keep an export of any existing records; arrange an explicit import before using real orders if there are records to retain.

## Checks before real shop use

Open the new HTTPS site on two devices. Create a fictional order on one; confirm it appears on the other. Upload a synthetic PDF/photo and verify the extracted quantities. Print a customer sticker before unpacking, confirming 60 × 30 mm on the real printer with scale 100%. Finish a test invoice and confirm the order changes to Here in shop. Sign in as two workers and confirm their private tasks/messages are separate. Test original-file downloads and backup recovery. Delete test data only through a reviewed migration/tool; do not reset a live project.

Verified on 22 October 2026: 64 automated tests passed; Netlify function bundling passed; real isolated PostgreSQL/PostgREST transactions and conflict handling passed; Chromium with production CSP passed PDF upload/checklist, two sessions, phone search, manual status, saved notification preference, labels before unpacking and English/Hebrew OCR. Backup/restore round-trip and checksum/overwrite rejection passed using synthetic private files.

Local validation is not a live-provider check. Signed Storage upload/CORS, project API key, Netlify routing/cookies, provider quotas and the real tablet/printer must be checked after accounts are connected. No paid plan is activated by the code; review the plan displayed in each account. Free tiers have storage, compute, credit and transfer limits and can pause or stop service. Supabase Free may pause inactive projects; it does not include downloadable managed daily backups. Hosting free allowances do not include paid SMS or WhatsApp sending.

## Backups and recovery

`/api/export` downloads business JSON with attachment references. **It is not a complete backup of private attachment bytes or worker credentials.** Use the owner-only command below from a trusted machine with securely configured Supabase URL/service key:

```sh
node tools/hosted-backup.mjs backup /private/backups/shop-YYYY-MM-DD
```

The destination must not exist. The tool writes records plus every ready private attachment and a checksum manifest; permissions are owner-only on Unix. It excludes active sessions/rate-limit counters and aborts if records change while copying. A failed backup folder has no valid completed manifest and should be discarded; retry into a new folder when the shop is quiet. Backups include customer details, messages and password hashes: keep them encrypted in independent off-site storage, never in Git or the public website. No off-site scheduler/destination is connected yet. Until one is configured, take daily manual backups and test recovery.

To restore, use a **new empty Supabase project**, run the migration, securely point the tool at the new project's URL/service key and run:

```sh
node tools/hosted-backup.mjs restore /private/backups/shop-YYYY-MM-DD
```

The tool verifies all checksums before uploading files and refuses to overwrite a populated database. Files upload first; records are restored atomically afterward. Keep workers off the destination during restore. Restore failure before the final commit may leave private orphan files, but does not expose partially restored records. After success configure the new project's secrets in the separate Netlify site, sign in and verify orders, private messages and attachments before switching users over. No active sessions are restored.

Canceled uploads can leave orphan private objects/metadata and consume storage. Monitor Storage use; automatic orphan cleanup is not implemented. Do not delete attachments merely because they are old: past delivery reviews may reference them.

## Reproduce checks

```sh
npm test
node tools/build-netlify.mjs
netlify functions:build --src netlify/shop-functions --functions .netlify-shop/functions
node tools/check-hosted-postgres.mjs
node tools/check-hosted-browser.mjs
```

Postgres check uses isolated Docker containers (Postgres 17 and PostgREST 12); no shop account. Browser check uses external Playwright at `/workspace/bookshop-tools/node_modules/playwright` and system Chromium; it tests built assets with production CSP and mock private Storage. A real Supabase/Netlify smoke test is still required. Local Node/SQLite development remains available with `npm start`.

Gmail supplier parsing, email drafts inside the four real mailboxes, actual SMS/WhatsApp sending and hosted Erply lookup remain disconnected. A Gmail chat plugin authorizes this chat, not this deployed application.
