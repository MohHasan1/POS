# QuickPOS Windows installer

QuickPOS is packaged as a local Windows application without Electron or another desktop framework. The installer contains the Next.js standalone server, the Windows x64 SQLite native module, a pinned Node.js runtime, and a small hidden launcher. The cashier opens QuickPOS from a normal shortcut and uses it in the default browser at `http://127.0.0.1:3210`.

## Build the installer

The installer must be built on Windows so the standalone trace contains Windows-native SQLite files. For a quick test build in GitHub:

1. Open **Actions → Build Windows installer (fast)**.
2. Select **Run workflow**.
3. Wait for the `QuickPOS Windows x64 fast` job to finish.
4. Download the private `QuickPOS-Windows-x64-fast` workflow artifact.
5. Extract `QuickPOS-Setup.exe` before running it.

The fast workflow skips the separate lint, unit-test, and `tsc` jobs, but it still creates the production standalone build, validates the launcher syntax and Windows libSQL native module, exercises the packaged launcher twice, and compiles the real Inno Setup installer. Use **Build Windows installer** for final release validation; it performs all source checks before packaging and uploads the longer-lived `QuickPOS-Windows-x64` artifact.

Both workflows use Node.js 24.22.0 and pnpm 10.32.1, install from the frozen lockfile, share the Next.js build cache, and reuse the pinned Node.js runtime already installed by GitHub Actions instead of downloading it again. Neither workflow publishes a GitHub Release or makes the installer public.

For debugging on a Windows workstation, run:

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm windows:check
pnpm test
$env:DATABASE_ADAPTER = "sqlite"
$env:DATABASE_URL = "file:./windows-build.db"
$env:PAYLOAD_SECRET = "local-build-only-secret"
pnpm build
pnpm package:windows
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/windows/smoke-test.ps1
& "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe" installer\quickpos.iss
```

`pnpm package:windows` expects the active Windows Node.js runtime to be x64 version 24.22.0, matching the runtime bundled by the workflows.

Do not build a customer installer from macOS. The native dependency check intentionally rejects a release without the Windows x64 libSQL module.

## Installation and daily use

`QuickPOS-Setup.exe` installs for the current Windows user and does not request administrator access. It creates desktop and Start Menu shortcuts. On first launch the hidden launcher:

1. Creates the user's data, backup, log, and runtime-state directories.
2. Generates a random persistent Payload secret if one does not already exist.
3. Binds the web server to `127.0.0.1` only.
4. Runs pending Payload migrations through the database-backed health check.
5. Opens the default browser only after the application and database are ready.

Starting the shortcut again opens the running instance instead of starting another server. If port `3210` belongs to another program, QuickPOS stops and records the error. The port can be changed in `%LOCALAPPDATA%\QuickPOS\config.json` while QuickPOS is stopped.

Use **Start Menu → QuickPOS → Stop QuickPOS** before shutting down Windows, restoring a database, or performing manual maintenance. Startup and server logs are stored in `%LOCALAPPDATA%\QuickPOS\logs`.

## Data, upgrades, and backups

Customer data never lives in the installation directory:

| Purpose                   | Location                                      |
| ------------------------- | --------------------------------------------- |
| SQLite database           | `%LOCALAPPDATA%\QuickPOS\data\pos.db`         |
| Persistent Payload secret | `%LOCALAPPDATA%\QuickPOS\data\payload-secret` |
| Pre-migration backups     | `%LOCALAPPDATA%\QuickPOS\backups`             |
| Logs                      | `%LOCALAPPDATA%\QuickPOS\logs`                |
| Port configuration        | `%LOCALAPPDATA%\QuickPOS\config.json`         |

The launcher keeps the newest ten closed-database backup sets. Each set contains `pos.db` and any SQLite WAL sidecar files that existed before migrations. A migration failure prevents the browser from opening, stops startup, and leaves the backup available for recovery.

To upgrade, run the newer `QuickPOS-Setup.exe` for the same Windows user. The stable Inno Setup application ID causes it to update the existing installation. Setup stops the running server before replacing application files. The next launch backs up the existing database before applying new migrations.

Uninstall removes the application and shortcuts but deliberately preserves `%LOCALAPPDATA%\QuickPOS`. Remove that folder manually only when the customer has confirmed that the products, invoices, settings, backups, and secret are no longer needed.

## Restore a SQLite backup

1. Use the **Stop QuickPOS** shortcut and confirm the browser can no longer reach QuickPOS.
2. Copy `%LOCALAPPDATA%\QuickPOS\data` somewhere safe before changing it.
3. Choose a complete folder under `%LOCALAPPDATA%\QuickPOS\backups`.
4. Move the current `pos.db`, `pos.db-wal`, and `pos.db-shm` files out of the `data` folder.
5. Copy all database files from the selected backup folder into `data`.
6. Keep the existing `payload-secret`; do not replace or regenerate it.
7. Start QuickPOS and verify products, invoices, and Business Information.

If startup still fails, preserve the database and logs and investigate before attempting another migration.

## Manual Windows acceptance checklist

- [ ] Install as a standard Windows user without an administrator prompt.
- [ ] Confirm the desktop and Start Menu shortcuts exist.
- [ ] Double-click QuickPOS and confirm no terminal window appears.
- [ ] Confirm one browser tab opens only after the Home page is ready.
- [ ] Disconnect the computer from the internet and restart QuickPOS.
- [ ] Configure Business Information and create a product.
- [ ] Complete simplified and standard checkouts and print both invoice formats.
- [ ] Scan or decode a finalized simplified invoice's Phase 1 QR code.
- [ ] Stop and reopen QuickPOS; confirm products, invoices, and settings remain.
- [ ] Double-click the shortcut while QuickPOS is running; confirm no duplicate server starts.
- [ ] Put an unrelated server on the configured port; confirm QuickPOS refuses to start and writes a log.
- [ ] Install a newer QuickPOS build over the old one and confirm data remains.
- [ ] Confirm a pre-migration backup was created before the upgraded database opened.
- [ ] Restore a copied backup with QuickPOS stopped and confirm its invoices are readable.
- [ ] Uninstall QuickPOS and confirm `%LOCALAPPDATA%\QuickPOS` still contains customer data.

The Windows GitHub Actions smoke test covers the bundled runtime, migration-driven database initialization, static assets, web manifest, clean shutdown, restart persistence, and pre-migration backup creation. Physical shortcut behavior, default-browser behavior, printing, disconnected operation, upgrade UX, and restore UX still require the manual checks above.
