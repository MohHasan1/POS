# Testing the Bangladesh profile

QuickPOS locks an installation to its selected country after the first invoice or receipt voucher is created, including drafts. Use an isolated SQLite database to test Bangladesh without changing or deleting an existing Saudi installation.

## Start an isolated Bangladesh installation

Stop the current development server, then create and migrate a separate test database:

```bash
DATABASE_URL=file:./bd-test.db \
QUICKPOS_MEDIA_DIR=./bd-test-media \
pnpm migrate
```

Start QuickPOS with the same database and media overrides:

```bash
DATABASE_URL=file:./bd-test.db \
QUICKPOS_MEDIA_DIR=./bd-test-media \
pnpm dev
```

Open `http://localhost:3000`. Create the initial Payload administrator at `http://localhost:3000/admin` if prompted. Complete first-run business setup and select **Bangladesh**.

The test installation is stored in `bd-test.db`, while uploaded test media is stored in `bd-test-media`. The original `pos.db` and its media remain unchanged.

## Verification checklist

### Business and settings

- Business name and address are required.
- Bangla business name, Trade License, TIN, and BIN are optional.
- Currency is shown as `৳` or BDT.
- Dates and reporting periods use `Asia/Dhaka`.
- VAT preferences are hidden.
- The default secondary product language is Bangla.
- Auto-translation can be enabled or disabled without making translation failures block product saving.

### Products and sales

- English product name and price are the only required product fields.
- Bangla names appear beside English when configured.
- Checkout offers a generic **Sales Invoice**, not Saudi simplified or standard invoice types.
- Checkout and Service Board sales contain no VAT.
- Printed Bangladesh invoices contain no ZATCA QR code.
- Printed amounts identify BDT and use Taka and Poisha wording.

### Service Board, vouchers, and reports

- Service Board creates Bangladesh Sales Invoices automatically.
- Receipt vouchers use English and Bangla document content.
- Receipt voucher amounts use BDT, Taka, and Poisha.
- Dashboard totals include sales from Checkout and Service Board.
- Today, month, and year boundaries follow Dhaka time.

## Return to the Saudi installation

Stop the Bangladesh test server and start QuickPOS normally:

```bash
pnpm dev
```

The values in `.env` will select the original `pos.db`. Keep `bd-test.db` if the Bangladesh test data will be reused later.
