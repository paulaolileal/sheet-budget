# Finanças — Gestão Pessoal com Google Sheets

App de gestão financeira pessoal construído em **React + Vite + TypeScript + Tailwind + shadcn/ui**.
Usa **Google Sheets como banco de dados** (zero backend próprio) e funciona em **modo local mock** por padrão.

## Stack

- React 19 + TypeScript + Vite
- Tailwind v4 + shadcn/ui
- React Router v7
- TanStack Query + TanStack Table
- React Hook Form + Zod
- Zustand (UI store)
- Recharts
- Google Identity Services (OAuth do client, **token em memória**)

## Arquitetura

```
src/
  domain/          Tipos e schemas Zod (regras de negócio puras)
  application/     Orquestração (repositoryProvider)
  infrastructure/  Implementações: MockRepository, GoogleSheetsRepository
  presentation/    UI: layouts, pages, components
  components/ui    shadcn primitives
  hooks/           React Query hooks
  services/        Config + Google Auth
  store/           Zustand
  utils/           Formatação
  types/
```

A regra é simples: **UI depende de `domain` e `hooks`, nunca de infraestrutura diretamente.**
O `repositoryProvider` decide em runtime entre `MockRepository` e `GoogleSheetsRepository`.

## Rodando localmente

```bash
npm install
npm run dev
```

Sem variáveis de ambiente o app sobe em **modo mock** com os CSVs em `public/seed/`
(transactions, templates, accounts, categories, payment_groups). Mutações ficam no `localStorage`.

## Conectando ao Google Sheets

### 1. Preparar a planilha

Crie uma planilha com **5 abas**, com exatamente os mesmos cabeçalhos dos CSVs em `public/seed/`:

- `transactions` — colunas A:M
- `recurrence_templates` — colunas A:G
- `accounts` — colunas A:C
- `categories` — colunas A:B
- `payment_groups` — colunas A:E

Copie o `spreadsheetId` da URL: `https://docs.google.com/spreadsheets/d/<ID>/edit`.

### 2. Criar OAuth Client ID (Google Cloud Console)

1. Acesse https://console.cloud.google.com/ → crie um projeto.
2. Em **APIs & Services → Library**, habilite **Google Sheets API**.
3. **OAuth consent screen**: tipo *External*, preencha o mínimo, adicione seu e-mail em *Test users*.
4. **Credentials → Create credentials → OAuth Client ID**:
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:8080` (dev) e a URL pública (`https://seu-app.vercel.app`)
5. Copie o **Client ID**.

### 3. Configurar variáveis

Crie `.env.local`:

```
VITE_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
VITE_SPREADSHEET_ID=1AbC...XyZ
```

Reinicie o dev server. O app passa a usar `GoogleSheetsRepository`.
Em **Configurações** clique **Conectar com Google** — uma popup pede consentimento e
o token de acesso fica **somente em memória** (closure em `src/services/googleAuth.ts`).
Nunca gravamos `access_token` em `localStorage` nem `cookies`.

### Segurança — o que NÃO fazemos

- Não armazenamos `client_secret`, service account, nem private keys (são desnecessárias para o fluxo *implicit*).
- Não confiamos em payloads vindos da UI — toda mutação passa por `Zod`.
- Descrições são sanitizadas (HTML/tags removidos).
- `spreadsheetId` vive apenas em `src/services/config.ts`.

## Publicar no Vercel

1. `git push` para um repo no GitHub.
2. New Project no Vercel → import.
3. **Environment Variables** → adicione `VITE_GOOGLE_CLIENT_ID` e `VITE_SPREADSHEET_ID`.
4. Adicione a URL Vercel (`https://<projeto>.vercel.app`) em **Authorized JavaScript origins** no Google Cloud Console.
5. Deploy. Não há SSR — é SPA puro, build com `vite build`.

> Para SPA com React Router, o Vercel já trata fallback `index.html` automaticamente
> via `vercel.json` simples ou pelo build do Vite. Caso necessário, crie `vercel.json`:
> ```json
> { "rewrites": [{ "source": "/(.*)", "destination": "/" }] }
> ```

## Trocando para uma API futura

Para migrar para um backend próprio (Express, Hono, Supabase, etc.):

1. Crie `src/infrastructure/api/ApiRepository.ts` implementando `FinanceRepository`
   (`src/domain/repository.ts`).
2. Edite `src/application/repositoryProvider.ts` e retorne a nova implementação.
3. UI e hooks **não precisam mudar** — eles dependem do contrato, não da implementação.

## Convenções de dados

- `competencia`: `YYYY-MM` (string).
- Valores: número JS. Os CSVs seed usam vírgula BR; o parser converte na carga.
- `status=PAGO` exige `valor_final` (validado por Zod no input).
- Cancelar = mudar status para `CANCELADO`. **Nunca apaga histórico.**
- Editar = manter `transaction_id`.
- Marcar grupo (`fatura`) como PAGO → propaga para todas as transações vinculadas
  (`status=PAGO`, `valor_final ??= valor_previsto`).

## Funcionalidades incluídas

- **Dashboard**: totais previsto/pago/saldo + cards (fixos, parcelados, cartão) + gráfico por categoria.
- **Lançamentos**: tabela com filtros (mês, categoria, conta, status, tipo) + busca textual + edição inline em modal.
- **Cartões & Faturas**: faturas abertas, detalhes, "Pagar fatura" com confirmação.
- **Recorrências**: lista de templates + botão "Gerar para esta competência" (idempotente).
- **Configurações**: status da conexão, conectar Google, resetar mock.
- Tema claro/escuro, indicador de sincronização (sincronizando/salvo/erro), skeleton loading.

## Scripts

```bash
bun run dev       # dev server
bun run build     # build produção
bun run preview   # preview build
bun run lint
```
