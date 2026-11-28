# QuickPOS

A compact multi-country retail and service POS PWA built with Next.js, Payload CMS, Tailwind CSS, and shadcn/ui. Saudi Arabia and Bangladesh profiles are included.

## Local setup

1. Install Node.js 20.18.1 or newer and pnpm 9–11.
2. Copy `.env.example` to `.env` and replace `PAYLOAD_SECRET`.
3. Install dependencies with `pnpm install`.
4. Apply the SQLite migrations with `pnpm migrate`.
5. Start the app with `pnpm dev`.
6. Open `http://localhost:3000/admin` once to create the first Payload administrator.
7. Configure seller details at `http://localhost:3000/business` before issuing an invoice.

SQLite is the default local database. Enable the optional QuickPOS password and inactivity lock under **Settings → Admin access**. Save the one-time recovery code during setup. The Payload `/admin` account uses separate credentials.

Before upgrading an existing SQLite installation, back up the database and run `pnpm migrate` against the same `DATABASE_URL` the app uses. For a production build, follow with `pnpm build` and `pnpm start`.

## Testing the Bangladesh profile locally

An installation's country is locked after its first invoice or receipt voucher, including drafts. To test Bangladesh without changing or deleting an existing Saudi installation, use a separate SQLite database and media directory.

Stop the current development server, then prepare the test database:

```bash
DATABASE_URL=file:./bd-test.db \
QUICKPOS_MEDIA_DIR=./bd-test-media \
pnpm migrate
```

Start QuickPOS with the same test environment:

```bash
DATABASE_URL=file:./bd-test.db \
QUICKPOS_MEDIA_DIR=./bd-test-media \
pnpm dev
```

Open `http://localhost:3000`. Create the initial Payload administrator at `/admin` if prompted, then select **Bangladesh** during first-run business setup.

Verify the following behavior:

- Business name and address are required; Trade License, TIN, and BIN are optional.
- Currency is shown as `৳` or BDT and dates use `Asia/Dhaka`.
- VAT settings are hidden.
- English is the primary product name and Bangla is the optional secondary name.
- Checkout and Service Board create tax-free **Sales Invoices** without ZATCA QR codes.
- Receipt vouchers use English and Bangla with Taka and Poisha amount wording.
- Dashboard totals include sales from both Checkout and Service Board.

To return to the existing Saudi installation, stop the test server and run `pnpm dev` normally. The default `.env` will use the original `pos.db`; `bd-test.db` remains an isolated test database.

See [Testing the Bangladesh profile](docs/testing-bangladesh.md) for the complete verification checklist.

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

## Offline Windows installer

Run the manual **Build Windows installer** GitHub Actions workflow to create the private `QuickPOS-Setup.exe` artifact. It bundles the standalone server, Windows SQLite runtime, Node.js, launcher, and Inno Setup installer; the customer does not need Node.js, pnpm, Docker, a terminal, or internet access after installation.

See [Windows installer, updates, and recovery](docs/windows-installer.md) for build instructions, persistent data locations, backup restoration, and the manual acceptance checklist.

## Offline Mac installer

On an Apple Silicon Mac, run `pnpm package:mac` to build a personal QuickPOS disk image under `dist/macos`. The installed app opens in your browser and bundles Node.js and SQLite. See [Mac installation and data transfer](docs/macos-installer.md).
