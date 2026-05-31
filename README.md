# ATABAI

**NSBU → IFRS transformation platform for Uzbekistan.**

ATABAI automates the transformation of Uzbek national-standard accounting (НСБУ / NSBU)
into IFRS-compliant outputs. Go-to-market is **B2B2B** — sold through IFRS specialists who
each serve many client companies, not direct to end companies.

The single non-negotiable constraint is **transformation accuracy**. Specialists stake their
professional reputation on the output; a single error gets the product permanently dismissed.
Every architectural decision below serves that constraint first.

> **Reference documents**
> - **`ATABAI — Architecture: Current vs Target`** (May 2026) is the authoritative design spec.
>   Code comments reference it as *"architecture doc §N"*. Sections 6–7 of that doc are
>   **settled decisions** — do not re-litigate them without explicit instruction.
> - **This README** is the live source of truth for *what exists today and how to run it*.
>   It reflects the real codebase, not the design intent.
>
> An older `README.md` once described an Express + formula-template application. That app was
> never built; it was aspirational. The real backend is **NestJS** with a stateful ledger. If
> you find any reference to Express, `src/app.js`, Joi, or formula-template processing, treat it
> as historical noise.

---

## 1. What the product does

The transformation follows the IFRS specialist's **7-step methodology** (`Методика_МСФО.xlsx`):

1. **Reporting period + transition date** — first-time adoption seeds an opening balance, a
   comparative year, and a full reporting period. Multi-period from the start.
2. **IFRS accounting policy + chart of accounts** — analyze NSBU↔IFRS differences; build the
   account-level map.
3. **Reclassification** — move the trial balance (ОСВ) into the model and regroup
   (long/short-term, etc.). **Financial result unchanged.**
4. **Adjustment entries** — the real IFRS work: fixed assets (IAS 16), leases (IFRS 16),
   receivables / ECL (IFRS 9), revenue / control-transfer timing (IFRS 15). **This is where
   numbers move.**
5. **Deferred tax** — temporary differences from step 4 → deferred tax assets/liabilities (IAS 12).
6. **Assembly** — consolidate into the four final statements (Balance Sheet, P&L, Cash Flow, SOCE).
7. **Notes & disclosures.**

Upstream of the methodology, a **bank-statement posting module** (`Bank_statements.xlsx`, sheet
`ТЗ`) ingests bank statements and produces the double-entry postings that *become* the ledger /
ОСВ the methodology consumes. It is a separate system, not part of the transformation.

```
Bank ТЗ module            Методика steps 3–7              Output
────────────────         ───────────────────            ──────────────
bank statements    ─►    ОСВ / trial balance      ─►    4 IFRS statements
→ counterparty ID        → reclassification               + notes
→ treasury rules         → adjustment entries
→ Дт/Кт postings         → deferred tax
→ ledger / ОСВ           → assemble statements
```

---

## 2. Architecture in one paragraph

ATABAI is a **stateful, account-level ledger**. The system of record is a four-layer
transformation matrix held per `(organization, account, subconto-combo, period)`:

```
nsbu_base  →  reclassification  →  adjustment  →  ifrs
(immutable     (regrouping,         (journal       (= sum across
 client base)   no Δ result)         entries)        the row, derived)
```

- **`nsbu_base`** is immutable client input — it is what the client files with the regulator.
  The trust proposition is *"your NSBU untouched; exactly what we changed and why; the IFRS result."*
- **`reclassification`** regroups statements with zero net change to the financial result.
- **`adjustment`** is the **only** layer where numbers move. Each carries an IFRS standard tag,
  a human reason, its deferred-tax effect, and its disclosure text.
- **`ifrs`** is derived (`nsbu_base + reclassification + adjustment`), stored so the matrix view
  doesn't recompute on every read.

All money is **`Decimal128`** end to end (`ledger/decimal-arithmetic.ts`). Number-typed money
would let `0.1 × 100 ≠ 10.0` land in client-visible reports — unacceptable on the ledger spine.

> **Two transformation subsystems currently coexist.** The new **ledger spine**
> (`backend/src/ledger/*`) above is the real model and the future. A **legacy processor pipeline**
> (`backend/src/processors/*`) still exists: it does *presentation-only reclass* of one finished
> NSBU form into IFRS sections, changes zero numbers, and is wired to the old file-upload UI. It
> is being superseded — see §6.

---

## 3. Stack

| Layer | Technology |
|-------|------------|
| Backend | **NestJS** (module-per-feature), Mongoose / **MongoDB**, **Redis** |
| Excel | **ExcelJS** (write/format) + **SheetJS** (`xlsx`, read/convert) |
| Frontend | **Vue 3** (Vite, Pinia, vue-i18n), **Univer** (spreadsheet rendering), Vue Flow, Tailwind, Heroicons |
| Auth | JWT (per-user secret) + Google OAuth 2.0; TOTP 2FA for admins |
| Infra | Docker, GitLab CI/CD, Node ≥ 24 |

---

## 4. Repository layout

```
.
├── backend/            NestJS API
│   └── src/
│       ├── ledger/         ← the system of record (see §5)
│       ├── organizations/  ← access spine: User ⋈ Membership ⋈ Organization
│       ├── processors/     ← LEGACY presentation-reclass pipeline (being superseded)
│       ├── mappings/       ← versioned MappingSet infra (row-code → IFRS classification)
│       ├── files/          ← legacy upload + one-shot processing orchestration
│       ├── auth/  users/  admin/  jobs/  common/  config/  redis/  database/
│       └── templates/
├── frontend/           Vue 3 SPA
│   └── src/
│       ├── views/app/      ← onboarding, periods, chart, OSV upload, bank review,
│       │                     adjustments, matrix (ledger UI) + legacy upload/history
│       ├── views/admin/    ← users, files, mappings, locales, access, ledger overview
│       ├── stores/         ← auth, organizations, ledger, bank, adjustments, files, …
│       └── router/  components/  locales/  layouts/
├── shared/types/       Cross-cutting API types
├── docker-compose.yml
└── ATABAI — Architecture: Current vs Target.docx   (design spec; referenced as "arch doc §N")
```

---

## 5. The ledger module (`backend/src/ledger`)

### Schemas (`schemas/`)

| Schema | Purpose |
|--------|---------|
| `OrganizationProfile` | Ledger-side org requisites: transition date, base currency, ИНН, legal name, settlement accounts. (Kept separate from the access-spine `Organization`.) |
| `ReportingPeriod` | Period dimension — kinds `opening` / `comparative` / `reporting` / `regular`; lockable. |
| `ChartOfAccount` | The 507-account NSBU chart. **`Вид` (А/П/КА/КП)** drives intrinsic sign (КА/КП = contra). `subconto1/2/3` analytical dimensions. |
| `AccountBalance` | The universal currency. Unique `balance_key` = `(org, period, accountCode, layer, subconto1/2/3)`. Opening/period/closing × debit/credit, all `Decimal128`. |
| `JournalEntry` | Posting header. `source` (`bank_statement` / `opening_balance` / `reclassification` / `adjustment` / `manual`), `layer`, `status` (`draft` / `committed` / `reversed`), optional `adjustmentMeta`. |
| `JournalEntryLine` | One Dt/Cr leg. `amount ≥ 0` + `direction`; subconto axis mirrors `AccountBalance` so rollup is a flat group-by. |
| `Counterparty` | Keyed by ИНН; auto-created from bank rows. |
| `TreasuryRule` | Payment-purpose / long-tax-account → posting-account learning table. |

### Constants (`constants/`)
`balance-layers.ts` (the four layers), `account-vid.ts` (Вид → sign), `subconto-dimensions.ts`,
`treasury.ts` (treasury ИНН `201122919`).

### Services (`services/`, `ingestion/`, `bank/`, `adjustments/`)

| Service | Role | Status |
|---------|------|:------:|
| `ChartSeedService` | Seeds the 507-account NSBU chart per org (idempotent). | ✅ |
| `PeriodsService` | Seeds 3 first-time-adoption periods; lock/reopen with audit; `assertWritable`. | ✅ |
| `OrganizationProfilesService` | Upserts ledger-side org requisites. | ✅ |
| `LedgerBootstrapService` | One-shot: org + admin → profile → chart → periods. | ✅ |
| `OsvIngestionService` | Parses a 1C ОСВ export into `nsbu_base` balances (full-replace per period scope). | ✅ |
| **Bank posting engine** (`bank/`) | Full per ТЗ: counterparty resolve by ИНН, treasury rules, Scenario A/B postings (`5110`/`6010`/`4310`/`4010`/`6310`), green/yellow/red preview, learn-rule loop, draft → commit. | ✅ |
| `AdjustmentsService` | **Generic** overlay engine: draft → commit → reverse, balanced Dt=Cr, `adjustmentMeta`, append-only reversal, rolls up into balances. | ✅ (generic) |
| `BalanceRollupService` | Materializes `AccountBalance` rows from committed postings. | ✅ |
| `MatrixController` | Pivots balances into the `account × {nsbu/reclass/adjustment/ifrs}` matrix. | ✅ |

### HTTP surface (selected)
```
POST   /onboarding/organizations
GET    /organizations/:orgId/ledger/chart-of-accounts
GET    /organizations/:orgId/ledger/periods           POST .../periods            POST .../periods/:id/{lock,reopen}
POST   /organizations/:orgId/ledger/periods/:periodId/osv-imports
POST   /organizations/:orgId/ledger/periods/:periodId/bank-statements
GET    .../bank-statements/:uploadId/drafts           POST .../commit
PATCH  .../bank-statements/:uploadId/drafts/:entryId   POST .../drafts/:entryId/learn-rule
POST   /organizations/:orgId/ledger/periods/:periodId/adjustments
GET    /organizations/:orgId/ledger/adjustments        GET/POST .../adjustments/:entryId{,/commit,/reverse}
GET    /organizations/:orgId/ledger/periods/:periodId/{balances,matrix}
```

---

## 6. Build status — what's done and what's next

The build sequence (arch doc §9) is: **(1)** ledger spine + periods + ОСВ → **(2)** bank posting
engine → **(3)** adjustments, one IFRS standard at a time behind specialist sign-off; the
**access spine** lands in parallel.

### Done
- **Access spine** — `User` / `Membership` / `Organization`, capability-based authorization
  (`nsbu.base.{read,write}`, `ifrs.overlay.{read,write}`), org-scoped guard, never-last-admin,
  invite-accept (incl. pending email invites).
- **Ledger spine** — all schemas, chart seed (507 accts), period model + transition seeding,
  ОСВ ingestion, `BalanceRollupService`, matrix endpoint.
- **Bank posting engine** — complete per the ТЗ.
- **Adjustments** — the **generic** draft→commit→reverse engine.
- **Frontend** — full ledger UI: onboarding, organizations + switcher, periods, chart-of-accounts,
  OSV upload, bank upload + review (green/yellow/red), adjustment list/editor, matrix view.

### Not yet built — the NSBU → IFRS close
This is the live work. Steps 5–7 and the second half of step 3 have no service yet:

| # | Service | Methodology step | Why it matters |
|---|---------|------------------|----------------|
| 1 | **`ReclassificationService`** | 3 (2nd half) | Sign-symmetric, zero-net postings on the `reclassification` layer. Only the layer enum exists today. Can reuse the `AdjustmentsService` draft→commit machinery with a "net result = 0" invariant. |
| 2 | **`IfrsDerivationService`** | 6 (core) | Computes the `ifrs` layer = `nsbu_base + reclassification + adjustment`. **The matrix's `ifrs` column is currently empty without it.** |
| 3 | **`StatementAssemblyService`** | 6 (output) | Maps `ifrs` balances → the four forms (BS / PL / CF / SOCE). Needs the account-level statement map (the missing piece of step 2). Reuse legacy `stylers/*` for rendering, fed from the ledger. |
| 4 | **Per-standard adjustment engines** | 4 | IAS 16 / IFRS 16 / IFRS 9 / IFRS 15, each a domain service on top of the generic engine, shipped one at a time behind specialist sign-off. |
| 5 | **`DeferredTaxService`** | 5 | Sweep `adjustmentMeta.taxEffectAmount` across the period → IAS 12 entries on the adjustment layer. |
| 6 | **`NotesService`** | 7 | Project `adjustmentMeta.disclosureText` + structural data into a notes draft. |

**Suggested critical path to a closed-beta demo** (*"ОСВ in → 4 IFRS forms out"*):
**2 → 1 → 3**, then layer in per-standard engines (4) afterward.

### Known operational tails (documented in code)
- No bootstrap "resume" path on partial failure — a `LedgerResetService` (super_admin) is planned.
- Bank running-balance excludes drafts, so sequentially-dependent payments in one statement need
  batch commits.
- ОСВ ingestion writes balances with null subconto; the bank engine is subconto-aware. Grain can
  diverge for per-counterparty receivable/payable accounts.

---

## 7. Running locally

**Prerequisites:** Node ≥ 24, a MongoDB instance, a Redis instance, Docker (optional).

```bash
cp .env.sample .env       # then fill in MONGO_*, JWT_*, GOOGLE_* (OAuth), REDIS_PASSWORD, etc.
```

### Backend
```bash
cd backend
npm ci
npm run start:dev         # nest start --watch  (http://localhost:${BACKEND_PORT})
```
Other scripts: `npm run build` · `npm run start:prod` · `npm run typecheck` · `npm run lint` · `npm test`

### Frontend
```bash
cd frontend
npm ci
npm run dev               # vite, http://localhost:8080
```
Other scripts: `npm run build` · `npm run typecheck` · `npm run lint`

### Docker Compose
`docker compose` brings up **redis**, **backend**, and **frontend-prod**. **MongoDB is expected
to be external** (managed/host) — its service block is intentionally commented out in
`docker-compose.yml`; point `MONGO_*` in `.env` at your instance.

```bash
docker compose up -d
docker compose logs -f backend
```

> Use `docker compose` (with a space), never `docker-compose`.

---

## 8. Conventions

- **English** for code and all technical identifiers; **Russian** for product/business discussion.
- **`Decimal128`** for every monetary value — never `number`.
- Authorization resolves through the org-membership helper/guard — **never inline `=== userId`
  ownership checks** (keeps a future Firm/Practice layer additive).
- ExcelJS formula strings: **strip the leading `=`** (ExcelJS adds one).
- Account sign comes from **`Вид`** (А/П/КА/КП), not a hand-set per-row flag.