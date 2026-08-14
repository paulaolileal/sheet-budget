# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

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

### Removed

- The "trocar planilha" (switch spreadsheet) button/menu item from the
  sidebar (desktop and mobile) and from Settings → Fonte de dados —
  switching spreadsheets is no longer exposed in the UI.
- The raw env var display (`VITE_LEALTEK_API_URL`) from Settings → Fonte
  de dados.

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
