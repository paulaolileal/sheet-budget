# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                 # dev server (localhost:8080)
npm run build                # production build
npm run preview              # preview the production build
npm run lint                 # ESLint
npm run lint:fix             # ESLint with --fix
npm run format               # Prettier
npm run generate:pwa-icons   # regenerate PWA icon set from the source asset
```

There are no automated tests in this project.

## Architecture

This is a **frontend-only SPA** (React 19 + Vite + TypeScript) for personal finance management. The backend is Google Sheets — there is no server of our own, and there is no mock/offline mode: every user authenticates with Google and reads/writes a real spreadsheet via the Sheets API. The app is also an installable PWA (`vite-plugin-pwa`), using the `injectManifest` strategy with a hand-written service worker (`src/sw.ts`, not the default `generateSW`) — required to intercept the Android Web Share Target POST (see "Sharing a receipt" below). `src/sw.ts` precaches the app shell and replicates a `NetworkOnly` rule for `googleapis.com`/`api.lealtek.com` — finance data and auth calls are never served from cache.

### Layer dependency rule

```
presentation → hooks → domain ← infrastructure
                     ↑
              application (repositoryProvider)
```

- **UI and hooks** depend on `domain` types and never import from `infrastructure` directly.
- **`application/repositoryProvider.ts`** is the single decision point: it builds a `GoogleSheetsRepository` for the current user's spreadsheet (resolved via `spreadsheetStore`, keyed by email) and caches the instance per spreadsheet id.
- Adding a new backend means: create a new class implementing `FinanceRepository` (`src/domain/repository.ts`), then switch the provider — zero UI changes needed.

### Key files

| Path                                                  | Role                                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/domain/types.ts`                                 | All domain types (Transaction, RecurrenceTemplate, Account, Category, Income, InvoiceAmount, Debtor, Debt, PurchasePlan)   |
| `src/domain/schemas.ts`                               | Zod schemas — input validation and sanitization gate                                                         |
| `src/domain/importSchemas.ts`                         | Zod schemas for CSV import rows (one per entity) plus the CSV column layout per entity                       |
| `src/domain/repository.ts`                            | `FinanceRepository` interface — the contract every backend must implement                                    |
| `src/domain/purchasePlanning.ts`                      | Purchase-planning business rules: `projectMonthlyBalance` (shared monthly free-balance projection, also used by the Dashboard), `evaluatePlanFit`/`suggestBestStartCompetencia` (budget-fit verdicts), `buildPlanAmortization` — see "Purchase planning" below |
| `src/lib/amortization.ts`                             | Pure amortization math (Price/SAC/no-interest schedules) — no domain types, no I/O                            |
| `src/application/repositoryProvider.ts`               | Singleton factory — builds/caches the `GoogleSheetsRepository` for the active user's spreadsheet             |
| `src/hooks/queries.ts`                                | All TanStack Query hooks + mutations; `withSync()` drives the sync indicator                                 |
| `src/store/uiStore.ts`                                | Zustand: active `competencia` (YYYY-MM) + sync state (`idle/syncing/saved/error`)                            |
| `src/store/spreadsheetStore.ts`                       | Zustand: maps each user's email to their spreadsheet id (multi-tenant, one Sheet per user)                   |
| `src/store/authStore.ts`                              | Zustand (persisted): the signed-in Google user info (`UserInfo`) shown in the UI                             |
| `src/services/config.ts`                              | Reads `VITE_LEALTEK_API_URL` (the shared auth/backend base URL)                                              |
| `src/services/googleAuth.ts`                          | OAuth via the shared `lealtek-api` backend (Authorization Code + PKCE — see the `lealtek-api` repo); access token lives **in memory + sessionStorage** — never localStorage, and there is no client-side client_id/secret. `signIn()` is a full-page redirect to `lealtek-api`'s login endpoint; `initAuthScheduler()` (called once in `main.tsx`) consumes the token left in the URL after that redirect, then proactively renews it in the background (`POST /api/auth/refresh`, reading an httpOnly cookie server-side) before it expires and on tab focus/visibility, so `ensureFreshToken()` keeps the session alive transparently |
| `src/services/inAppBrowser.ts`                        | Detects in-app browsers (Instagram/Facebook/etc.) client-side, mirroring the authoritative check `lealtek-api` enforces server-side — Google refuses to render its OAuth screen inside these regardless of backend architecture |
| `src/services/swUpdater.ts`                           | `initServiceWorkerAutoUpdate()` (called once in `main.tsx`) registers the service worker, polls `registration.update()` hourly and on focus, and reloads once a new worker takes control — immediately if backgrounded, otherwise deferred to the next time it is — so an installed PWA self-updates without a manual reinstall |
| `src/infrastructure/google/googleApiFetch.ts`         | Shared fetch wrapper used by all Google REST clients (`GoogleSheetsRepository`, `DriveApiClient`, `SheetsInitializer`); ensures a fresh token per call and throws `GoogleAuthError` when silent refresh genuinely fails |
| `src/infrastructure/google/GoogleSheetsRepository.ts` | CRUD against Sheets API v4 — the only `FinanceRepository` implementation today                               |
| `src/infrastructure/google/SheetsInitializer.ts`      | Creates a brand-new spreadsheet with the 9 required tabs/headers (see schema below) during `/setup`          |
| `src/infrastructure/google/DriveApiClient.ts`         | Finds/creates the user's Sheet and its parent Drive folder during `/setup`                                   |
| `src/lib/csvParser.ts`, `src/lib/importTemplates.ts`  | CSV parsing (papaparse) and downloadable model CSVs used by the import feature                               |
| `src/utils/iconRegistry.ts`                           | Lucide icon registry (`ICON_REGISTRY`/`ICON_LIST`/`getIcon`) backing every `icon_id` field                   |
| `src/sw.ts`                                           | Custom service worker (`injectManifest`) — precache, `NetworkOnly` for Google APIs, and the Web Share Target `fetch` handler |
| `src/lib/receiptStore.ts`                             | IndexedDB hand-off for a shared receipt image, from `src/sw.ts` to `ShareTargetPage`                          |
| `src/lib/receiptParser.ts`                            | Regex-based extraction of valor/descrição/competência from OCR text of a Nubank receipt                       |
| `src/presentation/pages/ShareTargetPage.tsx`          | `/share-target` route: runs OCR (`tesseract.js`) on the shared image and opens `TransactionDialog` pre-filled  |
| `src/presentation/pages/PlanningPage.tsx`, `PurchasePlanDetailPage.tsx` | `/planning` list and `/planning/:planId` create/edit/simulate — see "Purchase planning" below |
| `src/hooks/useMonthlyBalanceProjection.ts`            | Hook wrapper around `projectMonthlyBalance` for a rolling horizon of competências                             |

### Google Sheets schema

`SheetsInitializer` provisions exactly these tabs when a user creates a new Sheet from `/setup` — this is the authoritative schema `GoogleSheetsRepository` reads/writes:

| Tab                   | Headers                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| `transactions`        | `transaction_id, template_id, competencia, descricao, categoria_id, valor, status, payment_account_id, tipo_lancamento, plan_id` |
| `recurrence_templates`| `template_id, nome, categoria_id, payment_account_id, primeira_competencia, ultima_competencia, logo_url, icon_id, recurrence_type` |
| `accounts`            | `account_id, nome, tipo, icon_id, color`                                                              |
| `categories`          | `category_id, nome, icon_id`                                                                          |
| `incomes`             | `income_id, competencia, descricao, valor, icon_id`                                                   |
| `invoice_amounts`     | `invoice_id, payment_account_id, competencia, valor_real`                                             |
| `debtors`             | `debtor_id, nome, telefone, icon_id`                                                                   |
| `debts`               | `debt_id, debtor_id, competencia, descricao, valor, status, tipo, parent_debt_id`                     |
| `purchase_plans`      | `plan_id, nome, descricao, valor_compra, taxa_juros, taxa_juros_periodicidade, numero_parcelas, forma_amortizacao, competencia_inicio, margem_minima, categoria_id, payment_account_id, status, created_at, updated_at` |

If you add a field to a domain type, it must be added both here (so `/setup` creates the column on new sheets) and to any spreadsheet Paula already has (manually, via Google Sheets) — `GoogleSheetsRepository` does not migrate existing sheets. In particular, a spreadsheet created before purchase planning shipped needs the `purchase_plans` tab (headers above) and the `plan_id` column (10th, `J`) added manually to its existing `transactions` tab.

### Routes

| Path            | Page                                         |
| --------------- | -------------------------------------------- |
| `/login`        | Google sign-in                               |
| `/setup`        | First-run: create/locate the user's Sheet    |
| `/`             | Dashboard (totals, charts)                   |
| `/transactions` | Transactions table with filters              |
| `/incomes`      | Incomes                                      |
| `/debtors`      | Debtors/debts owed to the user (charge via WhatsApp, `src/utils/whatsapp.ts`) |
| `/cards`        | Cards & invoices                             |
| `/recurrences`  | RecurrenceTemplates                          |
| `/planning`     | Purchase-planning list (saved simulations); `/planning/:planId` is create/edit/simulate, `/planning/novo` for a new one |
| `/share-target` | Landing page for a shared receipt image (see "Sharing a receipt" below); lazy-loaded, not in the nav |
| `/settings`     | Categories, data source (Sheet, import), app |

`AppShell`'s mobile bottom nav only pins its 4 most-frequent items (Dashboard, Lançamentos, Receitas, Cartões); the rest (Recorrências, Devedores, Planejamento) live behind a "Mais" overflow `Sheet` so the nav grid doesn't outgrow the screen as sections are added. The desktop sidebar always lists every item.

### Data conventions

- `competencia` is always `YYYY-MM` (string). It is the primary filter throughout the app.
- Monetary values are JS numbers. The Sheets repository and the CSV importer both parse Brazilian comma notation (`parseCurrency` in `src/lib/currency.ts`).
- `transactions` support both a soft cancel (`status: "IGNORADO"`, excluded from totals but kept for history) and a real hard delete (`deleteTransaction`, row removal via Sheets `deleteDimension`) — the UI (`TransactionDialog`) exposes the hard delete directly. `debts`, `accounts`, `categories` and `debtors` only support hard delete.
- Entity ids (`category_id`, `account_id`, `debtor_id`, etc.) are generated by the repository from the name/description + timestamp (`src/lib/idgen.ts`) — never supplied by the caller. This matters for CSV import: external files can't know these ids, so relations are resolved by **name**, not by id (see below).
- `debts` with `tipo: "EMPRESTIMO"` model an accumulating loan without a separate sheet: each abatement is a new row (not an edit) whose `valor` is the *remaining balance*, not the amount abated, linked back to the loan's root row (the one with no `parent_debt_id`) via `parent_debt_id`. `status` is meaningless on these rows — pending/settled is derived by comparing the latest row's `valor` to zero. See the grouping/derivation logic in `DebtorsPage.tsx` (`loanChains`/`loanRepresentatives`) and the abatement flow in `DebtDialog.tsx`.
- `Transaction.plan_id` links a `PARCELADO` transaction back to the `PurchasePlan` that generated it (via "Confirmar compra"); `null` for every manually-created or recurring-generated transaction. See "Purchase planning" below.

### Importing data from a CSV

`src/presentation/components/ImportDialog.tsx` (opened from Settings → "Fonte de dados" and from the Dashboard's empty state) lets the user upload a CSV per entity — Categorias, Contas, Receitas, Devedores, Transações or Dívidas — using the friendly column layout defined in `src/domain/importSchemas.ts` (`IMPORT_COLUMNS`/`IMPORT_ROW_SCHEMAS`). A "baixar modelo" button generates a template file via `src/lib/importTemplates.ts`.

Transações/Dívidas reference Categoria/Conta/Devedor **by name** in the CSV. The `useImportRows` mutation (`src/hooks/queries.ts`) resolves each name to an id against the existing entities (case-insensitive), creating the entity on the fly if no match exists, before calling `createTransactionsBatch`/`createDebtsBatch`.

### Purchase planning

`PurchasePlan` (`purchase_plans` sheet) is a saved simulation for a large financed purchase (e.g. a car): principal, interest rate + periodicity, number of installments, amortization method, desired start competência, and a minimum monthly margin the user wants to keep. Its installment schedule is **never persisted** — it is 100% derivable from those fields and recomputed client-side on demand:

1. `src/lib/amortization.ts` builds the raw schedule (`buildPriceTable`/`buildSacTable`/`buildLinearTable`, dispatched by `buildAmortizationTable`) — pure math, no domain types. `PRICE` is a fixed installment with decreasing interest; `SAC` is constant amortization with a decreasing installment; `SEM_JUROS` is the linear no-interest split (same math as `TransactionDialog`'s simple installment flow), kept as a baseline to compare "financiar com juros" vs "parcelar sem juros".
2. `src/domain/purchasePlanning.ts` layers business rules on top: `projectMonthlyBalance` projects the user's monthly free balance (receitas − despesas) — this is the same rule as the Dashboard's trend chart, extracted so both features share one source of truth (`useMonthlyBalanceProjection` wraps it for components); `evaluatePlanFit` cross-references a schedule against that projection to produce a per-month verdict (`folga`/`apertado`/`nao_cabe`, the worst month "wins" for the plan's overall badge — see `PlanVerdictBadge.tsx`); `suggestBestStartCompetencia` ranks candidate start months by how well they fit.
3. Confirming a plan (`useConfirmPurchasePlan`) creates the real `PARCELADO` transactions via the existing `createTransactionsBatch`, using the calculated installment values (not a linear split), and stamps each with `plan_id` for traceability. The plan then flips to `status: "CONFIRMADO"` and its simulation-defining fields (value, rate, installments, method, start) become read-only in the UI — only metadata (nome/descrição/categoria/conta) stays editable.
4. There is **no automatic reconciliation** after confirmation: editing/deleting a generated transaction by hand does not update the plan. `PurchasePlanDetailPage` only does a read-only, on-the-fly diagnostic (comparing the stored plan's schedule against the current `plan_id`-matching transactions) to show a "N parcelas foram alteradas ou removidas" hint — mirrors the EMPRESTIMO note below in spirit (derive, don't persist a second copy of the truth).

### Sharing a receipt (Android Web Share Target)

When the app is installed as a PWA on Android, it's listed in the OS "Share" menu for images. Sharing a Nubank transfer receipt screenshot ("Comprovante de transferência") pre-fills a new Pix transaction (`tipo_lancamento: "MANUAL"`, `status: "PAGO"`):

1. `manifest.share_target` (`vite.config.ts`) makes Android POST the shared image (multipart, field `receipt`) to `/share-target`.
2. `src/sw.ts`'s `fetch` handler intercepts that POST, stores the image Blob in IndexedDB (`src/lib/receiptStore.ts`), and redirects to `/share-target?receiptId=...`.
3. `ShareTargetPage` reads the Blob back, runs on-device OCR with `tesseract.js` (no image or API key ever leaves the device — this is why `injectManifest`/OCR was chosen over calling a vision LLM), and extracts fields with `parseNubankReceipt` (`src/lib/receiptParser.ts`), which is regex-based and specific to today's Nubank layout.
4. The extracted `{ descricao, valor, competencia }` are passed to `TransactionDialog` via its `draft` prop (used only in create mode) — the user still picks categoria/conta and confirms before anything is saved; fields the parser couldn't find are just left blank.

If Nubank changes the receipt layout, `parseNubankReceipt` simply won't find the fields — the dialog still opens, just empty, no crash.

### Environment variables

```
VITE_LEALTEK_API_URL=    # base URL of the shared lealtek-api backend (auth), required
VITE_BASE_PATH=          # optional; router basename and Vite `base` for sub-path deployments
```

The spreadsheet id is not an env var — it's resolved per user at runtime (`spreadsheetStore`, populated during `/setup` via the Drive API).

### Adding mutations

All mutations live in `src/hooks/queries.ts`. Wrap the repo call in `withSync()` so the UI sync indicator reflects the operation. After success, call `qc.invalidateQueries` for the affected query keys defined in `qk`.

### Routing

React Router v7 with a single layout route (`AppShell`), guarded by `ProtectedRoute` (auth) and `SpreadsheetRoute` (has a linked Sheet). Unknown routes redirect to `/404`.

### UI components

`src/components/ui/` contains shadcn/ui primitives (Radix-based). Do not modify these files unless updating the library — extend them via composition in `src/presentation/components/`.

### Icons

Categories, accounts, incomes, debtors and recurrence templates each carry an `icon_id` column. `src/presentation/components/IconPicker.tsx` lets the user pick one from `src/utils/iconRegistry.ts` (a curated subset of `lucide-react`); `AppIcon.tsx` renders it and `ServiceLogo.tsx` falls back to a colored initial (hashed from the name) when no `icon_id`/`logo_url` is set. `SheetsInitializer` already includes these columns for new spreadsheets (see schema above); a spreadsheet created before this feature shipped needs the `icon_id`/`logo_url` columns added manually.

### Theme and PWA install

`src/presentation/theme/ThemeProvider.tsx` is a light/dark context persisted to `localStorage` (`finapp:theme`), defaulting to the OS preference. The toggle itself lives in `src/presentation/components/AppearanceCard.tsx`, shown on the Settings → Aplicativo tab — there is no theme toggle in the sidebar/header, to keep that space for the signed-in user's name and email. `src/hooks/useInstallPrompt.ts` + `src/presentation/components/InstallAppCard.tsx` (same tab) surface the native "Add to Home Screen" prompt (and an iOS-specific manual-install hint, since iOS Safari has no `beforeinstallprompt` event).
