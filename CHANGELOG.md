# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Reproducible Windows x64 offline installer workflow with a bundled Node.js runtime and Inno Setup.
- Hidden single-instance Windows launcher with a database-backed health check, browser startup, logs, and safe shutdown shortcut.
- Persistent per-user SQLite storage, generated Payload secret, and rolling pre-migration backups under Local AppData.
- Fast Windows installer workflow for short build-test iterations while retaining the full release-validation workflow.
- Versioned Windows workflow artifacts with JSON build metadata and SHA-256 checksum manifests.
- Separate Business Information page backed by the existing shop settings Global.
- Persistent English/Bangla language and Light/Dark/System appearance controls in Application Settings.
- Shop display names and recent-invoice shortcuts on the redesigned Home page.
- Saudi retail POS application shell with English and Bangla UI switching.
- Product catalogue management with multilingual names, VAT categories, and price modes.
- Checkout cart with custom items, decimal-safe VAT totals, and simplified or standard invoice issuance.
- Immutable invoice snapshots, idempotent finalization, controlled numbering, history, and A4 reprinting.
- ZATCA Phase 1 UTF-8 TLV QR generation from finalized invoice values.
- Payload CMS models for products, invoices, shop settings, SQLite development, and MongoDB production.
- Installable PWA manifest with a safe offline notice.
- Persistent light and dark theme toggle that respects the system preference on first use.
- Automatic and on-demand offline English-to-Arabic and English-to-Bangla product-name translation, with Chrome model download status and progress.
- CSV product import and export with SKU-based updates, validation, and inactive-product support.
- Focused financial, QR, numbering, and duplicate-finalization tests.

### Changed

- Enabled Next.js standalone output and explicit Windows libSQL runtime tracing for offline packaging.
- Normalized persistent SQLite file URLs for native Windows paths and exposed packaged-runtime logs when CI smoke tests fail.
- Materialized pnpm dependencies in a hoisted layout so copied standalone releases retain Next.js runtime module resolution.
- Shortened Windows installer packaging by caching Next.js output, using faster native directory copies, and reusing the already pinned Node.js runtime.
- Split legal business details from device-level application and invoicing preferences.
- Centralized application navigation and added distinct Business Information and Settings entries.
- Reworked the Home page around a primary Start Checkout action and practical daily shortcuts.
- Renamed the application to QuickPOS and moved Start Checkout into a full-width Quick Actions row.
- Removed the deprecated TypeScript `baseUrl` option while preserving explicit source aliases.

### Security

- Payload REST mutations require an authenticated administrator and finalized invoices cannot be updated or deleted through regular access rules.
