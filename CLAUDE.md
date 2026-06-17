# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # dev server (localhost:5173)
npm run build      # production build
npm run preview    # preview the production build
npm run lint       # ESLint
npm run format     # Prettier
```

There are no automated tests in this project.

## Architecture

This is a **frontend-only SPA** (React 19 + Vite + TypeScript) for personal finance management. The backend is Google Sheets — there is no server of our own.

### Layer dependency rule

```
presentation → hooks → domain ← infrastructure
                     ↑
              application (repositoryProvider)
```

- **UI and hooks** depend on `domain` types and never import from `infrastructure` directly.
- **`application/repositoryProvider.ts`** is the single decision point: it returns either `MockRepository` or `GoogleSheetsRepository` based on env vars, and caches the instance.
- Adding a new backend means: create a new class implementing `FinanceRepository` (`src/domain/repository.ts`), then switch the provider — zero UI changes needed.

### Key files

| Path | Role |
|---|---|
| `src/domain/types.ts` | All domain types (Transaction, RecurrenceTemplate, Account, Category, PaymentGroup) |
| `src/domain/schemas.ts` | Zod schemas — input validation and sanitization gate |
| `src/domain/repository.ts` | `FinanceRepository` interface — the contract every backend must implement |
| `src/application/repositoryProvider.ts` | Singleton factory — picks Mock vs Google Sheets at runtime |
| `src/hooks/queries.ts` | All TanStack Query hooks + mutations; `withSync()` drives the sync indicator |
| `src/store/uiStore.ts` | Zustand: active `competencia` (YYYY-MM) + sync state (`idle/syncing/saved/error`) |
| `src/services/config.ts` | Reads `VITE_GOOGLE_CLIENT_ID` / `VITE_SPREADSHEET_ID`; exposes `useMock` flag |
| `src/services/googleAuth.ts` | Google Identity Services OAuth flow; access token lives **in memory only** (closure) — never in localStorage |
| `src/infrastructure/repositories/MockRepository.ts` | Seeds from `public/seed/*.csv` via PapaParse; mutations persist to `localStorage` |
| `src/infrastructure/google/GoogleSheetsRepository.ts` | CRUD against Sheets API v4 |

### Routes

| Path | Page |
|---|---|
| `/` | Dashboard (totals, charts) |
| `/transactions` | Transactions table with filters |
| `/cards` | Cards & invoices (PaymentGroups) |
| `/recurrences` | RecurrenceTemplates |
| `/settings` | Settings: Google auth, mock reset |

### Data conventions

- `competencia` is always `YYYY-MM` (string). It is the primary filter throughout the app.
- Monetary values are JS numbers. Seed CSVs use Brazilian comma notation; the CSV parser converts on load.
- `status=PAGO` requires `valor_final` — enforced by `transactionInputSchema` refinement.
- Records are never deleted (soft cancel via `status=CANCELADO`).
- Paying a `PaymentGroup` (fatura) propagates `status=PAGO` to all linked transactions.

### Environment variables

```
VITE_GOOGLE_CLIENT_ID=   # OAuth Client ID (Web application type)
VITE_SPREADSHEET_ID=     # Google Sheets document ID
```

Without these, the app runs in mock mode automatically (`config.useMock = true`).

### Adding mutations

All mutations live in `src/hooks/queries.ts`. Wrap the repo call in `withSync()` so the UI sync indicator reflects the operation. After success, call `qc.invalidateQueries` for the affected query keys defined in `qk`.

### Routing

React Router v7 with a single layout route (`AppShell`). Unknown routes redirect to `/404`.

### UI components

`src/components/ui/` contains shadcn/ui primitives (Radix-based). Do not modify these files unless updating the library — extend them via composition in `src/presentation/components/`.
