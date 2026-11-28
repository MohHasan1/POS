# QuickPOS on Mac

The local Mac build targets Apple Silicon on macOS 14 or later. It opens QuickPOS in your default browser and uses bundled Node.js and SQLite, so installed copies can run offline.

## Build and install

1. On an Apple Silicon Mac with the Xcode command-line tools, Node.js, and pnpm, run `pnpm install --frozen-lockfile` and `pnpm package:mac` from the project.
2. Open the versioned disk image under `dist/macos`. Drag **QuickPOS.app** into **Applications**. If you prefer a per-user install, copy it to the **Applications** folder in your home folder.
3. Open **QuickPOS.app** from Finder. On first launch, QuickPOS prepares the database, opens your browser, and takes you to business setup.

Packaging downloads a pinned Apple Silicon Node.js archive and verifies its SHA-256 before bundling it. Set `QUICKPOS_MAC_NODE_ARCHIVE` to the absolute path of that archive to reuse it. The build writes a `.dmg.sha256` file alongside the disk image. The app is ad-hoc signed for a personal build created on your Mac. Apple Developer ID signing and notarization are needed for the client distribution workflow.

## Daily use and upgrades

QuickPOS opens at `http://127.0.0.1:3210`. Open the Mac app again to reopen the browser page. **QuickPOS → Open Logs** opens the startup and server logs. Use **QuickPOS → Quit QuickPOS** to stop the server, or choose **Quit** on the Dock icon. Closing a browser tab leaves the server running.

Install an update by quitting QuickPOS and replacing **QuickPOS.app** in Finder. The next startup backs up the current database and media before applying pending migrations. QuickPOS keeps the latest ten startup backups. If a port is occupied, quit the other app or set a different port in `config.json` while QuickPOS is stopped.

| Purpose | Location under `~/Library/Application Support/QuickPOS` |
| --- | --- |
| Database | `data/pos.db` |
| Uploaded files | `data/media` |
| Persistent secret | `data/payload-secret` |
| Backups | `backups` |
| Startup and server logs | `logs` |
| Port configuration | `config.json` |

To uninstall, quit QuickPOS and move the app to Trash. Keep the Application Support folder to retain the business data. To restore a backup, quit the app, move the current database and its `-wal` and `-shm` files and media folder to a safe place, then put the backup's `pos.db` and matching `media` in `data`. Keep the original `payload-secret`.

## Transfer an existing installation

1. Quit QuickPOS on both machines. Take a backup of the source and prepare a separate working copy. On Windows, the installed source is under `%LOCALAPPDATA%\QuickPOS\data`. A Mac development installation uses the database and media paths configured when its server starts.
2. On the Mac, consolidate the copied SQLite database into a single file with SQLite's `.backup` command. Keep any matching `pos.db-wal` alongside the source copy until the snapshot is complete, so committed transactions are included. Keep the matching media and original Payload secret with the copy. For a development installation, the original secret is the `PAYLOAD_SECRET` value in its environment.
3. Check the new snapshot with `PRAGMA integrity_check;` and `PRAGMA foreign_key_check;`. Verify the country and expected invoice count. If `payload_migrations` has a development entry with `batch = -1`, follow the extra steps below.
4. With the Mac app stopped, open `~/Library/Application Support/QuickPOS` in Finder. Put the validated copy in an empty `data` folder as `pos.db`, `media`, and `payload-secret`. If the destination already has business data, move its entire `data` folder to a safe location first so that each installation remains recoverable.
5. Open QuickPOS and check Business Information, invoice history, and the business logo. The imported installation retains its saved country and access settings.

### Preparing a development database copy

Payload's development schema-push marker requires an interactive reconciliation step. Use a **copy** and run the project's migration command against it with `QUICKPOS_SCHEMA_PUSH=0` and `DATABASE_URL` set to the copied file's absolute SQLite file URL. Confirm the migration prompt after checking that it points to the copy. Verify the full migration history, the SQLite integrity checks above, and existing business records against the source. On that verified copy, remove only the development marker with `DELETE FROM payload_migrations WHERE name = 'dev' AND batch = -1;` before moving it to the Mac app's data folder.

## Verify a build

Mount the disk image, copy the app to a temporary folder, and run `node scripts/macos/smoke-test.mjs "/path/to/QuickPOS.app"`. The smoke test provisions disposable data, exercises the bundled launcher and server, and verifies the app signature after use. For an upgrade check, pass a second argument pointing to a prepared older SQLite data folder containing `pos.db`, `media`, and `payload-secret`.

Use Finder once to confirm the normal launch, browser reopening from the Dock, and **Quit QuickPOS**. Repeat the launch with internet access unavailable to check offline use.
