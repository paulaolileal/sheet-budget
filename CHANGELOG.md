# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Dashboard: "Parcelas terminando" carousel — auto-rotating cards for
  installment purchases (`PARCELADO`) whose final installment falls in the
  selected competência, each showing "Parcela finalizada" (already paid) or
  "Parcela acaba esse mês" (still pending) plus the installment value; the
  card subtitle states how many purchases are ending ("3 compras parceladas
  terminando este mês").
- Dashboard: month-over-month comparison card, positioned below the
  installment carousel — a dedicated KPI layout (two stat tiles, Lançamentos
  and Valor total, each with its own delta chip) plus a plain-language
  summary sentence and a Melhor/Pior/Misto/Igual verdict badge, rather than
  reusing Lançamentos' thin inline stat-bar as-is.

### Changed

- Extracted the verdict/delta color logic behind the month-over-month
  comparison (`verdictFor`/`deltaTone`/verdict label/tone/icon maps) and the
  installment-grouping helpers (`stripParcela`/`parseParcela`/
  `groupInstallments`) into shared modules
  (`src/presentation/components/MonthComparison.tsx`, `src/lib/parcela.ts`)
  so the Dashboard's new KPI card and carousel reuse the same logic as
  Lançamentos instead of duplicating it, while each page renders its own
  presentation.

## [2026-08-14]

### Changed

- Migrated Google authentication from Google Identity Services' implicit
  OAuth2 flow to the shared `lealtek-api` backend (Authorization Code +
  PKCE). Silent renewal now calls `POST /api/auth/refresh` on
  `api.lealtek.com` instead of `requestAccessToken({ prompt: 'none' })`,
  which depended on Google's own third-party session cookie and broke under
  cookie partitioning / installed PWAs. Interactive sign-in is now a
  full-page redirect to `lealtek-api`'s login endpoint instead of a GIS
  popup.
- Redesigned the sidebar's LealTEK credit to echo the marketing site's
  footer treatment (larger logo plus a tagline) instead of a faint,
  cramped icon-only link, while keeping it in its existing slot rather than
  turning it into a full page footer.
- Moved the theme toggle out of the sidebar and mobile header into
  Settings → Aplicativo (new "Aparência" card), freeing up room in the
  sidebar's user info row for the signed-in user's name and email.
- Removed the desktop sidebar's sync indicator row, which collapsed to a
  stray empty line whenever sync was idle; sync status is still shown in
  the mobile header.

### Added

- In-app-browser detection (`src/services/inAppBrowser.ts`) shows an "open
  in your browser" prompt instead of the sign-in button when the app is
  opened inside Instagram/Facebook/LinkedIn/etc. — Google rejects OAuth
  inside these webviews regardless of backend architecture, so this is a
  client-side mirror of the same check `lealtek-api` enforces authoritatively
  server-side.

### Removed

- `VITE_GOOGLE_CLIENT_ID` — no longer needed client-side; the OAuth Client
  ID now only lives server-side in `lealtek-api`. Replaced by
  `VITE_LEALTEK_API_URL`.
- The "trocar planilha" (switch spreadsheet) button/menu item from the
  sidebar (desktop and mobile) and from Settings → Fonte de dados —
  switching spreadsheets is no longer exposed in the UI.
- The raw env var display (`VITE_LEALTEK_API_URL`) from Settings → Fonte
  de dados.
