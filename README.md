# Healthcare Social Media Content Calendar Generator

Internal monorepo for generating Instagram-ready monthly calendars for healthcare clients, backed by Claude Haiku, BullMQ, and ExcelJS.

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Anthropic API key; generation defaults to **`claude-haiku-4-5`** (override with `ANTHROPIC_MODEL`, e.g. `claude-sonnet-4-5` for higher quality)

## Install

```bash
cd /path/to/content-generate
npm install
```

The `postinstall` script builds the `@hc/shared` workspace package so the server and client can import shared types.

## Environment

Copy `.env.example` to **`.env` in the repository root** (recommended) or to `server/.env`. The API (`server/src/loadEnv.ts`) and the root **`npm run db:migrate` / `db:seed`** scripts load both paths (later file wins on duplicate keys). Never commit real secrets.

Typical production stack:

### Neon (Postgres)

Use the **pooled** connection string from the Neon dashboard so Prisma and serverless bursts share the pooler. Include `?sslmode=require`. Set `DATABASE_URL` to that value.

### Railway (Redis)

Create a Redis service on Railway, open **Variables**, and copy `REDIS_URL` (or construct `redis://default:PASSWORD@HOST:PORT` from the connection tab). BullMQ uses this for queues and workers.

### Object storage (`STORAGE_TYPE=S3`)

The code uses the official **AWS SDK for JavaScript (S3)**. Variable names are always **`AWS_*`** — that is required by the SDK. For **Cloudflare R2**, you still fill `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` with the values from an **R2 API token** (they are not IAM users; the names are just what the SDK expects).

#### Cloudflare R2

The dashboard URL looks like `https://<ACCOUNT_ID>.r2.cloudflarestorage.com/<BUCKET>`. **Split** it:

- **`S3_ENDPOINT`** — origin only, e.g. `https://ebb3590f9b5494439c819d69152eb760.r2.cloudflarestorage.com` (no `/bucket` path).
- **`R2_ACCOUNT_ID`** (optional) — same hex as in that host; we can build `S3_ENDPOINT` for you if the full URL is omitted.
- **`AWS_BUCKET_NAME`** — bucket name only (e.g. `content-gen`).
- **`AWS_REGION=auto`**, **`S3_FORCE_PATH_STYLE=true`**, plus R2 token in **`AWS_ACCESS_KEY_ID`** / **`AWS_SECRET_ACCESS_KEY`**.

Do not put the bucket name inside `S3_ENDPOINT` or uploads will fail.

#### Amazon AWS S3

Use real **IAM access keys** (or another supported credential chain) in the same **`AWS_*`** variables:

- Leave **`S3_ENDPOINT`** and **`R2_ACCOUNT_ID`** unset (default AWS endpoints).
- Set **`AWS_BUCKET_NAME`**, **`AWS_REGION`** (e.g. `us-east-1`), **`AWS_ACCESS_KEY_ID`**, **`AWS_SECRET_ACCESS_KEY`**, **`S3_FORCE_PATH_STYLE=false`** (unless you use a custom endpoint).

Presigned URLs use the same client in both cases.

### Other

- `JWT_SECRET`, `ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL`
- `PUBLIC_APP_URL` — public base URL of this API (used in some LOCAL download links)
- `STORAGE_TYPE=LOCAL` for laptop-only dev (files under `LOCAL_STORAGE_PATH`)
- `VITE_API_URL` — set when the browser must call a different origin than the Vite dev server; empty locally uses the Vite `/api` proxy

## Database

```bash
npm run db:migrate
npm run db:seed
```

Run **`npm run db:migrate`** and **`npm run db:seed`** from the **repository root** (not `cd server`). Those commands use `scripts/db-migrate.cjs` / `db-seed.cjs`, which load **`.env` from the repo root** (and optional `server/.env`) before invoking Prisma, so `DATABASE_URL` is always visible to the CLI.

Prisma migrations live next to the schema at `server/src/prisma/migrations`. The checked-in `20250511120000_init` migration matches the models in `server/src/prisma/schema.prisma`.

The seed upserts `contact@techdr.in` and `support@techdr.in`. Their login password comes from **`TECHDR_PASSWORD`** in `.env` (default `techDr` if unset); run **`npm run db:seed`** after changing it so database hashes update. Demo clients + topic history attach to **contact@techdr.in**. Login is restricted to those two emails (registration is disabled).

## Development

Start PostgreSQL and Redis, then run:

```bash
npm run dev
```

- API: `http://localhost:4000`
- Client: `http://localhost:5173` (proxies `/api` to the API when `VITE_API_URL` is unset)

## Production build

```bash
npm run build
```

Run the compiled server with `npm run start -w server` after building.

## Architecture snapshot

- **Client (`/client`)**: React 18 + Vite, Tailwind, shadcn-style UI, TanStack Query + Table, SSE for BullMQ job progress.
- **Server (`/server`)**: Express, Prisma, BullMQ worker (concurrency 3), Claude integration, Excel builder, S3-compatible storage (AWS S3 or Cloudflare R2).
- **Shared (`/shared`)**: Medical specialty constants, **per-specialty service catalogs** (`SPECIALTY_SERVICES`), and shared DTO types. Clients store `services[]` chosen from the union of their specialties’ catalogs; Claude prompts include that list.

## Excel output

Workbooks follow the agency brief: frozen navy header row, department row tinting (`SP1`, `SP2`, `AWR`), wrapped cells, and `➕ ADDED` prefixes for AI-added awareness rows in the Code column when `isAIAdded` is true.

## Notes

- SSE authentication accepts either `Authorization: Bearer` or `?token=` (used by `EventSource` in browsers).
- Bulk ZIP export (`POST /api/export/bulk-zip`) currently bundles on-disk workbooks and is enabled for `STORAGE_TYPE=LOCAL`.
