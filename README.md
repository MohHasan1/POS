# QuickPOS

A compact Saudi Arabia retail POS PWA built with Next.js, Payload CMS, Tailwind CSS, and shadcn/ui.

## Local setup

1. Install Node.js 20.18.1 or newer and pnpm 9–11.
2. Copy `.env.example` to `.env` and replace `PAYLOAD_SECRET`.
3. Install dependencies with `pnpm install`.
4. Start the app with `pnpm dev`.
5. Open `http://localhost:3000/admin` once to create the first Payload administrator.
6. Configure seller details at `http://localhost:3000/business` before issuing an invoice.

SQLite is the default local database. The cashier UI is intentionally a trusted-device MVP without its own login gate.

Payload automatically synchronizes the SQLite schema during `pnpm dev`. Before serving a production build against SQLite, run `pnpm migrate` once, followed by `pnpm build` and `pnpm start`.

## Production database

Set the following environment variables to use Payload's MongoDB adapter:

```dotenv
DATABASE_ADAPTER=mongodb
DATABASE_URL=mongodb://user:password@host/database
PAYLOAD_SECRET=a-long-random-production-secret
```

Database content is not migrated automatically between SQLite and MongoDB.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm migrate
pnpm build
```

Browser printing provides A4 PDF output. The generated QR payload implements the five ZATCA Phase 1 TLV fields; this project does not implement Phase 2 signing, clearance/reporting, certificates, or a complete production compliance control environment.
