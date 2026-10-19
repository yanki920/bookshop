# Private hosted shop

**Render deployment is on hold while the owner considers free hosting.** See [the verified free-hosting review](FREE-HOSTING-REVIEW.md). Do not treat the paid blueprint as the selected deployment route.

This is a deployment package, not an already deployed website. It does not change the old Netlify site. A hosting-account sign-in and approval of the provider's paid service/disk are required. No hosting credential is available in the coding environment.

## Render deployment

1. Sign in to https://dashboard.render.com with the GitHub account that owns `yanki920/bookshop`.
2. Choose **New → Blueprint**, select `yanki920/bookshop`, and select branch **`codex/trial-preview`**. Blueprint path: `render.yaml`.
3. Enter two different passwords in the secure Render fields:
   - `BOOKSHOP_ACCESS_PASSWORD`: at least 12 characters. Shared shop entrance; browser username is **shop**. Workers can save it in their device's password manager.
   - `BOOKSHOP_OWNER_PASSWORD`: at least 10 characters. Private manager password, separate from the shared password. The manager username is **manager**.
4. Review Render's displayed service and persistent-disk price before confirming deployment. The blueprint requests one Starter Docker service, Frankfurt region and a 1 GB disk. Do not use an ephemeral/free disk for the SQLite database.
5. Wait until the service is healthy and open the HTTPS URL shown by Render. Enter the shared shop credentials once on each device. Open Tasks & Chat and sign in as manager to create each worker's personal account.

Render supplies `RENDER_EXTERNAL_URL`; the application uses it as its public HTTPS origin. A custom domain requires setting `BOOKSHOP_PUBLIC_ORIGIN` to that exact HTTPS origin and configuring it in Render. Automatic deploys are disabled: later code changes do not replace the running website until a reviewed manual deploy.

## Storage, access and backups

`/var/data/bookshop` contains orders/invoices, worker accounts, sessions and (once authorised) encrypted Gmail tokens and their key. It is on the persistent disk. The container's web process runs as the unprivileged node user. Only `/healthz` is public; the rest of the site and APIs require the shared shop password. Task conversations additionally require the existing personal account login.

Production starts without sample orders, invoices, tasks or workers. The manager is created once from the owner password. Changing that environment value afterwards does not reset an existing manager password. Existing browser-trial records are not automatically imported; retain their JSON export before any migration.

Backups run at startup and every six hours, retaining 14 snapshots in `/var/data/backups`. Each uses SQLite's online backup API and contains both databases and the Gmail encryption key, with restrictive permissions and a checksum manifest. These copies are on the **same disk**. They protect against application changes but are not off-site disaster recovery. Configure a separate protected off-site backup destination before relying on this for irreplaceable shop data. Do not place database/key backups in GitHub or a public download.

To restore, stop the service, preserve the current data directory, verify the snapshot manifest checksums and SQLite `PRAGMA quick_check`, then copy the snapshot databases and key into `/var/data/bookshop` and remove stale `-wal`/`-shm` sidecars before starting. Restore databases and Gmail key together. Rehearse on a separate data directory/service before replacing live data.

## Build and verification

The image pins Node's base-image digest and OCR package versions, includes English/Hebrew OCR models, and excludes local databases, local environment files and the standalone public trial from the build context. `docker build -t tiferes-shop .` builds the image normally. In the managed cloud, supply the configured combined CA bundle using `--secret id=proxy_ca,src=/etc/ssl/certs/ca-certificates.crt`; this CA mount is build-only, not retained in the image.

`tests/deployment.test.mjs` verifies private access, fresh empty startup, owner bootstrap, shared API reads, persistence and restoration of a real SQLite snapshot. The image was also exercised with an isolated Docker volume, restart, English and Hebrew invoice OCR and a runtime backup. It has not been deployed to a hosting provider yet.

Hosting does not connect Gmail, Erply, SMS or WhatsApp automatically. Those integrations retain their existing disconnected state. Erply remains read-only when configured. No external messages are sent by deployment.
