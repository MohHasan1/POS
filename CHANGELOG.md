# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

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

- Removed the deprecated TypeScript `baseUrl` option while preserving explicit source aliases.

### Security

- Payload REST mutations require an authenticated administrator and finalized invoices cannot be updated or deleted through regular access rules.
