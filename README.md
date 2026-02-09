# Be My Valentine 2026

Node/Express + SQLite + EJS app for sending playful, premium-optional Valentine experiences. Three personas: Sweet Notes (fortune-style), Achievement Unlocked, and Vintage Love Letter. Premium add-ons include time-capsule locks, passphrase, audio notes, gift/date reveal, and a printable keepsake card. Payments use IntaSend; media uses S3-compatible storage (tested with Cloudflare R2).

## Features
- Three recipient experiences:
  - **Sweet Notes (Fortune)**: open small notes, then the central love letter unlocks.
  - **Achievement Unlocked**: gamified unlocks ending in a legendary proposal.
  - **Vintage Love Letter**: wax seal, typewriter effect, optional audio.
- Premium gating: time lock, passphrase, audio note, gift reveal, keepsake card; all unlocked by one KES 50 payment.
- Recipient responses: accept/reject plus optional note back to the sender.
- Media proxy: audio and gift images served only when premium is unlocked.
- Dev-only premium unlock flag for local testing.

## Tech Stack
- Node.js + Express
- SQLite (via better-sqlite3)
- EJS templates, vanilla JS, and custom CSS
- S3-compatible storage (Cloudflare R2 tested)
- IntaSend payments + webhook challenge validation

## Running Locally
```bash
npm install
# Optional: enable dev premium unlock for testing
set PREMIUM_DEV_UNLOCK=1
npm start
```
App runs at `http://localhost:3000`.

## Env Vars
- Core: `PORT`, `NODE_ENV`
- Database: `DB_PATH` (e.g., `/app/data/database.sqlite` for Railway volume)
- Premium dev flag: `PREMIUM_DEV_UNLOCK` (set to `1` only in non-production to bypass payment gating)
- IntaSend: `INTASEND_PAYMENT_LINK`, `INTASEND_WEBHOOK_CHALLENGE`, `INTASEND_EXPECTED_AMOUNT=50`, `INTASEND_EXPECTED_CURRENCY=KES`, `INTASEND_EXPECTED_API_REF`
- Storage (R2/S3): access key, secret, bucket, region/endpoint as per your provider

## Payments (IntaSend)
- Creator pays via `INTASEND_PAYMENT_LINK` (reference is proposal ID; redirect/return URLs point to success page).
- Webhook: `POST /api/payment-webhook` must include the configured `INTASEND_WEBHOOK_CHALLENGE` and sends `invoice_id/reference`, `state/status`, amount, currency, api_ref.
- On success, `payment_status` is set to `paid`; premium content unlocks.

## Media Storage
- Uploads go to S3-compatible storage; URLs are proxied through `/media/:id/audio` and `/media/:id/gift/:index` with payment checks.
- If storage is not configured, uploads are rejected with a clear error.

## Deployment Notes
- Set `NODE_ENV=production` and `PREMIUM_DEV_UNLOCK=0`.
- Mount a persistent volume for SQLite or migrate to managed DB if you prefer.
- Configure IntaSend webhook to `/api/payment-webhook` and match the challenge value.
- Verify storage credentials in the target environment.

## Quick Test Plan
- Create each persona, open the recipient link, send a response note.
- Toggle premium dev flag locally to verify audio/gift/keepsake.
- In staging, run a real IntaSend payment and confirm webhook marks `payment_status=paid`.

## Project Structure (high level)
- `server.js` – Express app, raw body for webhook
- `db.js` – SQLite schema and prepared statements
- `routes/` – `pages.js` (views/gating/media proxy), `api.js` (create/respond/unlock/upload/webhook)
- `views/` – EJS templates (create, view, partials, success, keepsake)
- `public/` – CSS and static assets

## Contributing
Open an issue or PR. Keep UI changes aligned with the existing romantic aesthetic and be mindful of performance (free-tier friendly). For payments, do not change webhook validation without documenting the rationale.
