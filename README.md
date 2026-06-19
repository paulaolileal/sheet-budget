# Finanças — Gestão Financeira Pessoal com Google Sheets

Você anota suas contas no papel, numa planilha gigante, ou simplesmente não anota? A maioria das pessoas perde o controle financeiro não por falta de vontade, mas porque as ferramentas são complexas demais ou pedem cadastro em mais um serviço.

**Sheet Budget resolve isso de forma diferente:** usa a sua própria planilha do Google Sheets como banco de dados. Zero backend, zero mensalidade, zero dado seu em servidor de terceiro. Você já tem uma conta Google — isso é suficiente.

## Por que usar este sistema

### O problema que ele resolve

A maior parte dos gastos pessoais se repete todo mês: aluguel, assinaturas, academia, parcelas de cartão. São **recorrentes e parcelados** — e é exatamente aí que as pessoas perdem o controle: esquecem de lançar, perdem a conta de quantas parcelas restam, ou não percebem que o total fixo já compromete 80% do salário.

Este app foi construído com esse foco:

- **Templates de recorrência** — cadastre uma vez (Netflix, aluguel, parcela do carro) e o sistema gera os lançamentos mensais automaticamente, sem duplicar se você gerar duas vezes
- **Parcelados com visibilidade** — cada parcela é um lançamento com `tipo_lancamento=PARCELADO`, então você vê em qual mês cada parcela cai e quanto ainda vai pagar no futuro
- **Faturas de cartão** — lançamentos vinculados ao cartão se agrupam numa fatura; você registra o valor real cobrado e paga tudo de uma vez, propagando o status para cada item
- **Dashboard de tendências** — gráfico de 6 meses centrado no mês atual mostra se seus gastos estão subindo; aba Geral com filtro de período revela projeções e totais acumulados

### Por que Google Sheets

- **Sem servidor próprio** — zero custo de infraestrutura para o app de finanças em si
- **Você controla os dados** — a planilha é sua, no seu Google Drive, exportável a qualquer momento
- **Auditável** — você pode abrir a planilha e ver, editar ou corrigir qualquer dado diretamente
- **Backup automático** — o Google já faz isso por você
- **Funciona sem internet** — em modo mock local, sem precisar conectar

### O que você ganha de UI que uma planilha não te dá

- Dashboard visual com gráficos de tendência e distribuição por categoria
- Geração automática de lançamentos recorrentes com um clique
- Indicador de sync em tempo real (você vê quando o dado foi salvo na planilha)
- Tema claro/escuro, filtros rápidos, busca textual
- Controle de status por lançamento: pendente, pago, adiantado, ignorado

---

## Funcionalidades

### Dashboard

O dashboard é dividido em duas abas:

**Aba Mês** (padrão)
- Seletor de competência (mês ativo)
- Cards de resumo: Total de Receitas, Total Previsto, Total Pago, Saldo Restante
- Barra de progresso de pagamento do mês
- Cards rápidos: pendentes, fixos (recorrentes), cartão
- Gráfico de barras: top 8 categorias de gasto
- Gráfico de pizza: distribuição por tipo (Recorrente / Parcelado / À vista)
- Gráfico de barras: Entradas vs Saídas do mês
- Gráfico de barras: quantidade de lançamentos por mês (6 meses centrados no mês atual)
- Gráfico de linhas: tendência de gastos mensais (6 meses centrados no mês atual)

**Aba Geral**
- Filtros de intervalo de datas (início e fim de competência)
- Resumo acumulado do período selecionado: total de gastos e total de receitas
- Projeção de receitas no período

### Lançamentos

- Tabela agrupada por categoria com filtros de mês, categoria, conta, status e tipo
- Busca textual por descrição
- Botão **"Gerar Recorrências"** — cria lançamentos para o mês selecionado com base nos templates ativos (idempotente)
- Edição via modal com validação Zod
- Ações por linha: editar, deletar, marcar como pago / pendente / adiantado

### Receitas

- Registro de receitas por competência (salários, freelances, outras entradas)
- Tabela com ícone customizável por receita
- Cards: total do mês e quantidade de entradas
- CRUD completo

### Cartões & Faturas

- Navegação por mês com month picker
- Abas separadas por cartão
- Tabela de transações vinculadas à fatura
- Campo para registrar o **valor real da fatura** (diferente do previsto)
- Botão **"Pagar Fatura"** com confirmação — propaga `status=PAGO` para todas as transações vinculadas

### Recorrências (Templates)

- Cadastro de templates com nome, categoria, conta, período de vigência e ícone
- Filtros por categoria, conta e status (ativo/inativo)
- Paginação (12 por página)
- Geração de lançamentos on-demand para o mês desejado (idempotente — nunca duplica)
- Templates com `ultima_competencia` encerram automaticamente

### Configurações

- CRUD completo de **Categorias** (com ícone customizável)
- CRUD completo de **Contas / Cartões** (tipo: conta, cartão, carteira)
- Indicador de sincronização (sincronizando / salvo / erro)
- Status da conexão Google

### UX transversal

- Tema claro/escuro persistido
- Indicador de sincronização global em todas as mutações
- Skeleton loading em tabelas e cards
- Toast notifications
- Rota `/404` customizada

## Rotas da aplicação

| Rota            | Página                               |
| --------------- | ------------------------------------ |
| `/login`        | Login com Google OAuth               |
| `/`             | Dashboard — resumo financeiro do mês |
| `/transactions` | Tabela de lançamentos com filtros    |
| `/incomes`      | Gestão de receitas                   |
| `/cards`        | Cartões e faturas                    |
| `/recurrences`  | Templates de recorrência             |
| `/settings`     | Categorias, contas e configurações   |
| `/404`          | Página não encontrada                |

---

## Stack

- **React 19** + TypeScript + Vite 8
- **Tailwind v4** + shadcn/ui (Radix-based)
- **React Router v7** (SPA)
- **TanStack Query v5** + TanStack Table v8
- **React Hook Form** + Zod (validação e sanitização)
- **Zustand** (estado de UI: mês ativo + indicador de sync)
- **Recharts** (gráficos de barras, linhas e pizza)
- **Google Identity Services** (OAuth implícito, token em memória)

---

## Arquitetura

```
presentation → hooks → domain ← infrastructure
                     ↑
              application (repositoryProvider)
```

**Regra de dependência:** UI e hooks dependem de `domain` (tipos e contratos). Nunca importam diretamente de `infrastructure`.

O `repositoryProvider.ts` é o único ponto de decisão em runtime: retorna `MockRepository` (mock local) ou `GoogleSheetsRepository` dependendo das variáveis de ambiente.

### Estrutura de pastas

```
src/
  domain/
    types.ts              Tipos de domínio (Transaction, Income, Template, Account, Category, InvoiceAmount)
    schemas.ts            Schemas Zod — validação e sanitização de input
    repository.ts         Interface FinanceRepository — contrato que toda implementação deve seguir
  application/
    repositoryProvider.ts Singleton factory — escolhe Mock vs Google Sheets em runtime
  infrastructure/
    google/
      GoogleSheetsRepository.ts  CRUD via Sheets API v4
    repositories/                Pronto para novas implementações (API, Supabase, etc.)
  hooks/
    queries.ts            Todos os useQuery e useMutation com TanStack Query
  services/
    config.ts             Lê variáveis de ambiente, expõe useMock flag
    googleAuth.ts         Fluxo OAuth2 — token em memória (closure), nunca em localStorage
  store/
    uiStore.ts            Zustand: competência ativa + estado de sync
    authStore.ts          Zustand: informações do usuário autenticado
  presentation/
    App.tsx               Router raiz
    layouts/AppShell.tsx  Sidebar + outlet principal
    pages/                8 páginas (Dashboard, Transactions, Income, Cards, Recurrences, Settings, Login, 404)
    components/           Dialogs e componentes de domínio
  components/ui/          Primitivos shadcn/ui — não modificar diretamente
  utils/
    format.ts             brl(), competenciaLabel(), monthRange()
    iconRegistry.ts       Mapeamento icon_id → SVG
  lib/
    idgen.ts              Geração determinística de IDs
```

### Arquivos-chave

| Arquivo                                               | Papel                                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/domain/types.ts`                                 | Todos os tipos (Transaction, Income, RecurrenceTemplate, Account, Category, InvoiceAmount) |
| `src/domain/schemas.ts`                               | Schemas Zod — gate de validação de toda mutação                                            |
| `src/domain/repository.ts`                            | Interface `FinanceRepository` — contrato único                                             |
| `src/application/repositoryProvider.ts`               | Decide Mock vs Google Sheets em runtime                                                    |
| `src/hooks/queries.ts`                                | Todos os hooks de query e mutation; `withSync()` aciona o indicador de sync                |
| `src/store/uiStore.ts`                                | Zustand: competência ativa (YYYY-MM) + estado de sync                                      |
| `src/services/config.ts`                              | Lê `VITE_GOOGLE_CLIENT_ID` / `VITE_SPREADSHEET_ID`; expõe `useMock`                        |
| `src/services/googleAuth.ts`                          | OAuth implícito Google; token vive apenas em closure — jamais em storage                   |
| `src/infrastructure/google/GoogleSheetsRepository.ts` | CRUD contra a Sheets API v4                                                                |

### Entidades e convenções de dados

| Entidade               | Campos principais                                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Transaction**        | `transaction_id`, `template_id?`, `competencia`, `descricao`, `categoria_id`, `valor`, `status`, `payment_account_id?`, `tipo_lancamento`             |
| **RecurrenceTemplate** | `template_id`, `nome`, `categoria_id`, `payment_account_id?`, `primeira_competencia`, `ultima_competencia?`, `logo_url?`, `icon_id?`                  |
| **Income**             | `income_id`, `competencia`, `descricao`, `valor`, `icon_id?`                                                                                          |
| **Account**            | `account_id`, `nome`, `tipo` (CONTA/CARTAO/CARTEIRA), `icon_id?`                                                                                      |
| **Category**           | `category_id`, `nome`, `icon_id?`                                                                                                                     |
| **InvoiceAmount**      | `invoice_id`, `payment_account_id`, `competencia`, `valor_real`                                                                                       |

**Regras de negócio:**

- `competencia` é sempre `YYYY-MM` (string)
- `valor` é o único campo monetário de `Transaction` — não há distinção entre previsto e pago
- Registros nunca são deletados fisicamente — `status=CANCELADO` é o cancelamento
- Pagar uma fatura propaga `status=PAGO` para todas as transações vinculadas
- Geração de recorrências é idempotente: gerar para o mesmo mês duas vezes não duplica

### Status de transação

| Status      | Descrição                           |
| ----------- | ----------------------------------- |
| `PENDENTE`  | Lançamento previsto, ainda não pago |
| `PAGO`      | Pago — exige `valor_final`          |
| `ADIANTADO` | Pago antecipadamente                |
| `IGNORADO`  | Excluído do resumo sem cancelar     |

### Tipo de lançamento

| Tipo         | Label na UI | Descrição                          |
| ------------ | ----------- | ---------------------------------- |
| `RECORRENTE` | Recorrente  | Gerado por um template fixo mensal |
| `PARCELADO`  | Parcelado   | Parcela de uma compra parcelada    |
| `MANUAL`     | À vista     | Lançamento avulso                  |

---

## Rodando localmente

```bash
npm install
npm run dev        # http://localhost:5173
```

Sem variáveis de ambiente o app sobe em **modo mock** — dados de demonstração em `localStorage` para mutações. Nenhuma configuração extra necessária.

### Scripts disponíveis

```bash
npm run dev        # Dev server
npm run build      # Build de produção (output: dist/)
npm run build:dev  # Build em modo development
npm run preview    # Preview do build local
npm run lint       # ESLint
npm run format     # Prettier
```

---

## Conectando ao Google Sheets

### Passo 1 — Preparar a planilha

Crie uma planilha com **6 abas**, com os cabeçalhos exatamente como listados abaixo:

| Aba                    | Colunas                                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `transactions`         | `transaction_id`, `template_id`, `competencia`, `descricao`, `categoria_id`, `valor`, `status`, `payment_account_id`, `tipo_lancamento` |
| `recurrence_templates` | `template_id`, `nome`, `categoria_id`, `payment_account_id`, `primeira_competencia`, `ultima_competencia`, `logo_url`, `icon_id`         |
| `accounts`             | `account_id`, `nome`, `tipo`, `icon_id`                                                                                                  |
| `categories`           | `category_id`, `nome`, `icon_id`                                                                                                         |
| `incomes`              | `income_id`, `competencia`, `descricao`, `valor`, `icon_id`                                                                              |
| `invoice_amounts`      | `invoice_id`, `payment_account_id`, `competencia`, `valor_real`                                                                          |

Copie o `spreadsheetId` da URL:

```
https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit
```

### Passo 2 — Criar projeto no Google Cloud Console

1. Acesse https://console.cloud.google.com → crie um projeto
2. Em **APIs & Services → Library**, pesquise e habilite **Google Sheets API**
3. Em **APIs & Services → OAuth consent screen**:
   - Tipo: **External**
   - Preencha nome do app, e-mail de suporte e e-mail do desenvolvedor
   - Em **Test users**, adicione seu e-mail (obrigatório enquanto o app estiver em modo de teste)
   - Salvar e continuar (pode pular Escopos por ora)

### Passo 3 — Criar credencial OAuth Client ID

1. **Credentials → Create credentials → OAuth Client ID**
2. Tipo: **Web application**
3. Nome: ex. `Sheet Budget Web`
4. **Authorized JavaScript origins** — adicione:
   ```
   http://localhost:5173
   https://seudominio.com
   ```
5. Criar → copie o **Client ID** (formato: `xxxxx.apps.googleusercontent.com`)

> URIs de redirecionamento não são necessários para o fluxo implícito.

### Passo 4 — Configurar variáveis de ambiente

Crie `.env.local` na raiz do projeto:

```env
VITE_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
VITE_SPREADSHEET_ID=1AbC...XyZ
```

Reinicie o dev server. O app passa a usar `GoogleSheetsRepository`.

### Passo 5 — Autenticar no app

Em **Configurações**, clique **Conectar com Google** — uma popup abre pedindo consentimento.
O token de acesso fica **somente em memória** (closure em `src/services/googleAuth.ts`). Nunca é gravado em `localStorage` ou cookies.

### Segurança — o que NÃO fazemos

- Não armazenamos `client_secret`, service account ou private keys (desnecessários para o fluxo implícito)
- Não confiamos em payloads da UI — toda mutação passa por Zod antes de chegar ao repositório
- Descrições são sanitizadas (HTML e tags removidos)
- `spreadsheetId` vive apenas em `src/services/config.ts`
- `access_token` jamais persiste entre sessões

---

## Deploy

### Digital Ocean App Platform

**Passo 1 — Criar o app**

1. Acesse https://cloud.digitalocean.com/apps → **Create App**
2. Conecte ao GitHub e selecione o repositório
3. Configure o componente:
   - **Type:** Static Site
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
   - **Plan:** Starter ($0)

**Passo 2 — Configurar variáveis de ambiente**

Em **Settings → Environment Variables**, adicione:

| Variável                | Valor                              |
| ----------------------- | ---------------------------------- |
| `VITE_GOOGLE_CLIENT_ID` | `xxxxx.apps.googleusercontent.com` |
| `VITE_SPREADSHEET_ID`   | `1AbC...XyZ`                       |

**Passo 3 — Configurar roteamento SPA**

Para que o React Router funcione em rotas internas (ex: `/transactions`), configure o documento de fallback no App Platform:

1. Em **Settings → App Spec**, edite o YAML e adicione `catchall_document`:
   ```yaml
   static_sites:
     - name: sheet-budget
       catchall_document: index.html
   ```
2. Ou via UI: **Settings → Components → seu site → Error Document** → informe `index.html`

**Passo 4 — Deploy**

O Digital Ocean faz deploy automático a cada push na branch `main`. A URL temporária ficará disponível em:

```
https://sheet-budget-XXXXX.ondigitalocean.app
```

---

## Domínio personalizado (Cloudflare + Digital Ocean)

### Passo 1 — Adicionar domínio no Digital Ocean

1. Acesse o app → **Settings → Domains → Add Domain**
2. Digite o domínio (ex: `financas.meusite.com`) → **Add**
3. O Digital Ocean mostrará o registro DNS necessário (CNAME)

### Passo 2 — Configurar DNS no Cloudflare

1. Acesse https://dash.cloudflare.com → selecione o domínio
2. Vá em **DNS → Add Record**:

```
Type:    CNAME
Name:    financas        (ou @ para domínio raiz)
Target:  sheet-budget-XXXXX.ondigitalocean.app
Proxy:   ON (laranja)
TTL:     Auto
```

> Com proxy Cloudflare ativado, o SSL é gerenciado automaticamente.

### Passo 3 — Atualizar origens autorizadas no Google Cloud Console

Em **Credentials → seu OAuth Client ID → Authorized JavaScript origins**, adicione:

```
https://financas.meusite.com
```

Sem isso, o login com Google será bloqueado no domínio personalizado.

### Passo 4 — Verificar

Aguarde a propagação DNS (geralmente < 5 min com Cloudflare) e acesse o domínio. HTTPS estará ativo automaticamente.

---

## Trocando para uma API futura

Para migrar para um backend próprio (Express, Hono, Supabase, etc.):

1. Crie `src/infrastructure/api/ApiRepository.ts` implementando `FinanceRepository` (`src/domain/repository.ts`)
2. Edite `src/application/repositoryProvider.ts` para retornar a nova implementação
3. UI e hooks **não precisam mudar** — dependem do contrato, não da implementação
