# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Purchase planning ("Planejamento"): a new dedicated page
  (`/planning`, `/planning/:planId`) to simulate a large financed purchase
  (e.g. a car) before committing to it. A plan records the purchase value,
  interest rate, number of installments and desired start competência;
  the simulation is computed entirely client-side and supports three
  amortization methods — Price (fixed installment), SAC (constant
  amortization) and Sem juros (linear, the same math as today's simple
  installment split, used as a no-interest baseline) — switchable instantly
  to compare total interest paid. The simulation cross-references the
  installment schedule against the user's projected monthly free balance
  (receitas − despesas, reusing the Dashboard's trend logic) plus a
  configurable minimum monthly margin, surfacing a per-month fit verdict
  (cabe com folga / aperta o orçamento / não recomendado) and suggesting
  the best of the next 12 competências to start the purchase. Plans persist
  to a new `purchase_plans` sheet so they can be reopened and re-simulated
  (change installments/rate/start month) later. Confirming a plan generates
  the real `PARCELADO` transactions in Lançamentos (via the existing batch
  creation) with the calculated — not linear — installment values, linked
  back to the plan through a new `plan_id` field on `Transaction`/`transactions`.
  A plan's `valor_compra` (full price) and optional `valor_entrada` (down
  payment) are entered separately — the financed principal used in every
  calculation is `valor_compra - valor_entrada` — so the user doesn't have
  to do that subtraction by hand before simulating. Each row in the
  installment breakdown now also shows the amortização (how much of that
  installment pays down principal, net of interest) alongside the
  installment total and running saldo devedor.
- Purchase planning: an early-payoff simulator (`EarlyPayoffSimulator`)
  lets the user pick, per installment, a competência they actually intend
  to pay it in — showing the present-value discount for paying ahead of
  the due date at the contract's own monthly rate (the "quitação
  antecipada" discount Brazilian lenders owe under CDC art. 52 §2º), plus
  a running total and total interest saved. Validated against a real CDC
  vehicle-financing payoff statement (an installment paid ~43 months
  early discounted from R$ 989,70 to R$ 591,78, matching the formula to
  within a few reais at the app's month-only competência granularity).
- Mobile bottom nav: items beyond the four most-frequent ones (Dashboard,
  Lançamentos, Receitas, Cartões) — Recorrências, Devedores and the new
  Planejamento — now collapse into a "Mais" overflow sheet instead of
  cramming a 7th column into the nav grid.
- Schema self-healing: `repositoryProvider.ts` now fires
  `SheetsInitializer.ensureSheets()` in the background the first time it
  builds a repository for a spreadsheet in a session, so a tab or column a
  shipped feature needs (e.g. this release's `purchase_plans` sheet and
  `Transaction.plan_id` column) reaches an already-onboarded user's
  spreadsheet automatically — no more asking users in production to edit
  their Sheet by hand or revisit `/setup`.

### Changed

- Extracted the Dashboard's month-over-month projection logic
  (`trendData`'s income-projection + `extraFatura` rule) into
  `projectMonthlyBalance` (`src/domain/purchasePlanning.ts`), shared with
  the new purchase-planning feature via `useMonthlyBalanceProjection` so
  both features read from the same projection instead of duplicating it.
  Along the way, the fallback for months without a lançada income changed
  from repeating the single latest income month's value to averaging the
  last 3 months that have one — smoother, and less skewed by whichever
  month happened to be the most recent.

### Fixed

- Purchase planning: the projected-balance horizon used to evaluate a
  plan's fit and its start-month suggestions was fixed at 24 months
  regardless of the plan's own installment count. Any competência a
  long-running plan (e.g. 60 parcelas) needed beyond that horizon read as
  an unknown saldoLivre of 0, which made every candidate month — even
  genuinely affordable ones — get flagged "não cabe". The horizon is now
  computed per plan (candidate window + `numero_parcelas`, or the plan's
  own `competencia_inicio` + `numero_parcelas` if further out) so it
  always reaches the schedule's last installment.

## [2026-08-17]

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
