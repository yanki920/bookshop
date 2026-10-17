# Tiferes customer orders — first version

A working development version for the customer-order workflow, with a responsive computer/tablet interface and a shared SQLite database. It is separate from the previous Firebase-backed application: no existing Firebase records are imported, modified or deleted.

## Run

Requires Node.js 24 or later. No npm dependencies or installation are needed.

```sh
npm start
```

The server listens on port 3000 on the local machine. For access from another device on a trusted development network, explicitly set `HOST=0.0.0.0` and allow the port through your network configuration. Do not expose this unauthenticated development version to the public internet. Public shop deployment needs HTTPS, employee authentication, access controls and backups first.

The database is created at `.data/orders.sqlite`; sample orders are inserted only when the database is empty. `BOOKSHOP_DATA_DIR` overrides the data directory. Data survives app restarts. Devices using this same server share records, refreshed every 15 seconds when no form is open. Concurrent updates are protected with a version check.

## Implemented

- Create and search customer requests and stock orders, supplier/payment filters, employee assignments and editable contact/payment details.
- Record actual supplier placement separately from a new request.
- Manually record dispatch or a Friedman invoice, check cumulative received/damaged quantities, record collection location, and handle partial deliveries.
- Print allocation labels for received items using the browser print dialog.
- Compose editable supplier email text for outstanding/damaged goods; copy it for manual sending. Damage photo preview uses the device camera/file picker but does **not** persist or attach the photo.
- Select orders and simulate batch customer notification. No SMS, email or WhatsApp is sent; the history explicitly records simulation.
- Prevent collection of incomplete/unpaid customer orders; record shelf placement for stock.
- Calendar-day Lehmanns follow-ups at 3 days (orange) and 6 days (red) with the responsible employee, live-derived follow-up list and order history.
- Monthly first-arrival averages, supplier breakdown, open orders older than a week, and full JSON export.

## Not yet connected / production work

Erply, Gmail, Textmagic and WhatsApp require real server integrations and account authorisation. Installing Gmail in ChatGPT does not authorise this application. Email parsing/matching, automated sending, automatic supplier ordering, saved damage attachments, product/customer lookup, authenticated employee auditing, backup automation, restoration and hosted multi-device deployment are not implemented. Payment status is entered manually and does not charge a customer or reconcile Erply.

Friedman alert timing and working-day/calendar-day policy await confirmation; no speculative Friedman deadlines are applied. Custom Judaica orders can be entered with notes, but weekly supplier batches and a structured customisation form are future work. Each record currently represents one product and one customer/stock allocation, rather than a multi-line supplier shipment.

## Verification

```sh
npm test
```

The API integration test uses a temporary isolated database and verifies the full lifecycle, partial delivery, invalid transitions, concurrent updates, payment guard, export and persistence across restart. Browser verification uses Playwright installed outside this checkout in `/workspace/bookshop-tools` with system Chromium.

## Preserve records

Download a full JSON export from the app before significant changes. This is an export, not an automatic backup/restore system. For a filesystem backup, stop this app server, then copy the entire `.data` directory (including SQLite sidecar files) to protected backup storage before restarting. Never commit that directory. Test a restore on a separate copy before relying on it.

The existing `netlify/` function and `netlify.toml` are retained from the earlier version. Static Netlify hosting alone does not run this new Node/SQLite server; use `npm start` for this version.

## Standalone trial before account connections

Run `node tools/build-demo.mjs` to generate `.demo/Tiferes-Trial.html` and instructions. The HTML embeds all assets and a browser-storage API adapter, so it needs no backend or account connection. Open it in a regular Chrome/Edge window. Use fictional data only: records are local to that browser/file, are not shared across devices and are lost if its browser storage is cleared. Export downloads a JSON copy; import is not implemented. No messages are sent. This adapter is for trying the workflow, not for production hosting or replacing the shared database.

Verified the self-contained HTML through a local static server, then disconnected browser networking and exercised creation, supplier placement, dispatch, receiving, notification simulation and export. Verified browser-storage persistence after reload. Direct `file://` navigation is blocked by the cloud browser's administrator policy, so direct-file opening on a user computer is not independently verified here.

## Erply connector (server-side preparation)

`integrations/erply.mjs` implements POST-based Erply authentication, an in-memory session and read-only customer/product name searches. It accepts `ERPLY_CLIENT_CODE`, `ERPLY_USERNAME` and `ERPLY_PASSWORD` from secure server settings. No account-specific credentials belong in the repository or standalone trial. Configure the password through environment settings, never chat, a URL, a frontend form or a committed file.

Run `NODE_USE_ENV_PROXY=1 node tools/check-erply.mjs` in the cloud environment to verify authentication through the configured proxy. It prints only success/failure, never credentials, tokens or business data. Secure settings in this cloud environment do not configure a separate hosting provider automatically. The connector is **not** wired to public browser/API lookup routes: authenticated employee access and secure server hosting are prerequisites. The static trial remains entirely disconnected. Existing Firebase and the original website are unchanged. Unit tests use fake credentials and mocked responses; they do not establish live Erply connectivity.

## Gmail: four-mailbox supplier inbox and reply drafts

The server now includes Google OAuth authorisation per registered mailbox, PKCE and one-use state, mailbox-identity verification, access-token refresh, encrypted refresh-token storage, explicit supplier-email search and same-mailbox/thread reply draft creation. The UI's Supplier inbox shows each connection independently. Plain-text email content is escaped; exact `TF-…` reference matches are suggestions, not automatic order-status changes. Searches return at most 20 messages per mailbox; background sync, attachment ingestion and automatic dispatch classification are not implemented. No Gmail send, delete, mark-read or label-modification endpoint is exposed.

Configure these server settings securely:

- `GMAIL_CLIENT_ID`: OAuth client ID registered in the shop's Google Cloud project.
- `GMAIL_CLIENT_SECRET`: corresponding OAuth application secret, **not a Gmail password**.
- `GMAIL_REDIRECT_URI`: exact registered callback URL ending `/oauth/gmail/callback`.
- `GMAIL_MAILBOXES`: comma-separated authorised shop mailbox addresses. An ignored local `.data/gmail-mailboxes.json` array can configure the development workspace instead.

In Google Cloud, enable the Gmail API, configure the OAuth consent screen and register an OAuth web client with that exact redirect address. Testing-mode apps need the intended account holders added as test users; Google may expire testing-mode refresh tokens after seven days. Live/production use may require Google's verification for these restricted scopes. Each mailbox owner must separately sign in and consent. Domains used: `accounts.google.com`, `oauth2.googleapis.com`, `gmail.googleapis.com`. Google OAuth configuration is missing in the current environment; no account is connected yet.

The app requests `gmail.readonly` and `gmail.compose`. Google bundles sending permission into the compose scope; there is no dedicated drafts-only scope. Our connector exposes draft creation only, with no send method, and never calls a send endpoint. Do not describe this OAuth grant itself as technically unable to send.

Tokens are AES-256-GCM encrypted in `.data/gmail.sqlite`, using a mode-0600 key in `.data/gmail-token.key`. Keep the key and complete database together in restricted backups; never commit or return them to a browser. This protects database contents at rest, but an administrator with both files can decrypt them. Explicitly searching supplier emails does not mark them read. Reply draft creation is a real Gmail write when connected, but sending remains manual.

All Gmail administration routes currently require both a loopback peer and a loopback Host header; they are unavailable on a public host. Production requires employee authentication, mailbox-access controls, protected HTTPS hosting and a browser-reachable callback. Do **not** weaken this guard simply to publish the trial. The shared static trial has no Google connection and must never contain OAuth credentials. The Gmail chat plugin does not provide app OAuth credentials or grant permissions to this server.

`tests/gmail.test.mjs` verifies PKCE/state, wrong-account rejection, mailbox-specific drafts, no send operation, header injection, scope checks, expiration, refresh and encrypted-token persistence with fake Google responses. Browser checks cover all four disconnected account cards and a simulated cross-mailbox search/draft flow. Live Google authorisation and real draft creation are untested pending the prerequisites above.

## Invoice-based Delivery desk

Delivery desk now manages supplier invoices independently of customer orders. Register the invoice number, supplier, dates, complete line list and optional original PDF/image, then start unpacking. Stock-only invoices need no customer record. Each line records a checked flag, good quantity, damaged quantity, computed shortage, notes and up to three saved damage photos. Original invoice/photo uploads accept PDF (invoice only), JPEG, PNG or WebP under 1 MB per file; invoice API requests are capped at 6 MB.

Unchecked lines are **not** counted as missing and prevent completion. A separate, confirmed action can explicitly mark remaining zero-count unchecked lines missing. Good plus damaged cannot exceed the invoiced quantity. Save progress before closing. Finish saves an immutable full check snapshot and generates one invoice-wide supplier shortage/damage draft with no automatic customer details. It does not send email or create a Gmail draft. Photos are retained in the record, not automatically attached to email.

Completed checks can be reopened with a reason, for example when replacements arrive. Previous completed snapshots and evidence remain available. Supplier follow-up notes, worker assignment, timestamps, optional original invoice downloads and printable invoice reports are retained. Worker names are manual assignments, not authenticated audit identities. The shared server stores invoices in SQLite; the standalone trial uses a separate browser-storage key and includes invoices in JSON export. Invoice entry is manual: importing supplier invoices from email/PDF line extraction is not implemented. Customer allocation/collection labels remain separate; invoice checking does not automatically allocate or update customer orders.

Tests cover 20 invoiced / 18 received, missing-vs-unchecked behavior, stock-only invoices, damage evidence, immutable review history, quantity and concurrency validation, duplicate invoices, API persistence across restart, export and generated standalone JavaScript validity. The browser check exercises the complete invoice journey and tablet layout.

## Invoice customer packing lists and labels

Each invoice now has a separate Customer labels action. Customer reservations, quantities ready to label and collection locations are stored in `invoice_allocations`, not inside supplier invoice documents or supplier complaint drafts. JSON exports contain a separate `invoiceAllocations` collection. Stock-only invoices work with an empty reservation list. The screen shows planned stock, customer reservations, good received units and goods still unallocated; unallocated goods are not silently treated as stock when a customer allocation remains undecided.

The clearly marked `LM-LABEL-DEMO` invoice contains ten good sample items already checked in, with three copies of Pirkei Avos allocated to two fictional customers. It can print three per-item customer labels immediately. Other invoices require good received quantities to be saved first, followed by staff-confirmed ready quantities in the packing list. “Fill ready quantities” proposes allocation in displayed row order; staff must review and save. Reservations cannot exceed invoiced quantities; ready allocations cannot exceed good checked-in quantities. Supplier corrections that would invalidate an existing ready allocation are rejected until allocations are adjusted. Labels include customer, product, order reference, invoice and collection location. Printing uses the browser's normal print dialog and supports at most 500 labels per action.

Reservations may be entered manually in this version; automatic matching to real customer orders or Erply and automatic order-status changes are not implemented. The ready-to-print fixture is added without resetting existing trial orders or invoices. Both invoice checking and customer allocation must be saved before switching views; print uses saved allocations. Tests cover separation, receipt limits, API persistence and the exact three-label browser output.

## Staff tasks and internal team chat — first version

The Staff tasks and Team chat screens share a workspace with five fictional identities (manager plus four workers). Select a sample identity to try its view. Staff tasks includes personal tasks, manager team overview, available jobs to claim, review queue and completed jobs. Jobs have an assignee, due date, priority, instructions, optional manager approval, waiting reason and change history. The sample delivery task links directly to its invoice. The manager can edit/reassign unfinished work. Daily/weekly recurring jobs create exactly one following job on completion or manager approval, using the previous due date plus one/seven days; this is not an independent daily scheduler.

Chat includes the shop group, direct conversations, unread badges, task-specific conversations and image attachments. Any visible chat message can be converted into an assigned task with a deadline and review requirement. Photos use the existing image reader (JPEG/PNG/WebP, under 1 MB). Messages are plain-text escaped. No external WhatsApp, SMS or email is sent; no calls, push notifications, delivery receipts or file types beyond supported images are implemented. Server views filter direct conversations for the selected sample identity, and task actions enforce simulated assignment/review rules.

The server saves the team state in the `team_workspace` table in the local SQLite database. The standalone trial uses a separate `tiferes-team-trial-v1` browser-storage key; switching sample workers within that browser lets you try both sides of conversations. It is **not shared between devices**, and clearing browser storage removes trial changes. The customer-order JSON export does not currently include the team workspace. While the app is open, updates use its existing 15-second polling cycle, paused when a form/dialog is active; there are no notifications when the app is closed.

**The worker selector is not authentication.** The server trusts the supplied sample actor, so anyone with this trial can switch identities. These sample direct conversations are not production-private messaging. Do not use real sensitive staff conversations. Production requires authenticated worker sessions, server-derived identities/roles, private hosting, authorisation on every endpoint and tested backups. Existing Gmail/Erply integration status is unchanged.

Tests verify worker views, direct-conversation filtering, claims, waiting reasons, manager reassignment and approval, single recurring-task generation, message-to-task linkage, chat comments/photos, unread pointers, revision conflicts and server-restart persistence. Browser verification covers the complete worker-to-manager flow plus tablet layout.
