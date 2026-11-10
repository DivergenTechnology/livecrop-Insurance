# Agricultural Insurance System

A full-stack **Next.js 16 + TypeScript** implementation of an event-driven agricultural insurance platform for crop and livestock farming — covering spatial plot registration, livestock biometric identity, satellite NDVI telemetry, FAO-Ky-based loss scoring, and mobile-money settlement.

Built from the [Implementation Plan](./Agricultural_Insurance_System_Implementation_Plan.pdf).

---

## ✨ What's inside

| Module | Description |
|---|---|
| **Spatial Boundary & Plot Registry** | GeoJSON polygon registration with turf.js overlap detection (returns 409 on collision — the plan's `ST_Intersects = 0` rule). |
| **Livestock Identity & Biometrics** | RFID tag registry with simulated 512-dim muzzle-print embeddings + cosine-similarity duplicate detection. |
| **Satellite & Telemetry Oracle** | 60-day mock Sentinel-2 NDVI simulator + daily rainfall + parametric trigger alerts. |
| **Dynamic Loss Engine** | Verbatim port of the plan's `calculate_crop_claim_payout` algorithm — REPLANT_ALLOWANCE vs. FULL_INDEMNITY using FAO Ky stage-sensitivity factors. |
| **Settlement & Mobile Payment Rails** | Mock M-Pesa / MTN / Airtel disbursement with transaction references. |

The app is a single `/` route with 7 tabs: Dashboard · Plots · Livestock · Policies · Telemetry · Claims · Settlements.

---

## 🧰 Tech stack

- **Framework**: Next.js 16 (App Router) + TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York)
- **Database**: Prisma ORM — SQLite for local dev, Postgres (Neon) for production
- **Charts**: Recharts
- **Spatial**: @turf/turf for polygon overlap detection
- **Icons**: Lucide

---

## 🚀 Local development

### Prerequisites
- Node.js 22+ (or Bun — recommended)
- SQLite (built into Node, no separate install needed)

### Setup

```bash
# 1. Install dependencies
bun install

# 2. Copy env template and adjust if needed
cp .env.example .env
# (default DATABASE_URL="file:./db/custom.db" works out of the box)

# 3. Push the SQLite schema
bun run db:push

# 4. Seed demo data (4 crop varieties, 3 farmers, 4 plots, 3 livestock, 2 policies, 240 telemetry readings)
bun run scripts/seed.ts

# 5. Start the dev server
bun run dev
```

Open http://localhost:3000 — you should see the Dashboard tab with seeded KPIs.

### Demo scenarios to try
1. **Plots → Register Plot** — try the default coordinates (overlapping with a Nyeri plot) → 409 toast. Change coordinates to a non-overlapping area → 201 success.
2. **Telemetry → Generate Telemetry** → click any plot → see the NDVI line chart with the 0.30 trigger threshold.
3. **Claims → File Claim** on the Maize policy → damage slider at 50% → **Assess** → see Stage=FLOWERING, Ky=1.30, payout = KES 78,000 (120,000 × 0.5 × 1.3). **Approve** → switch to Settlements → **Disburse** → mock MTN reference.

---

## ☁️ Production deployment

The app is configured for **Vercel + Neon Postgres** with **GitHub Actions** CI/CD.

### Architecture decision: SQLite → Postgres

Local dev uses SQLite (zero-config, file-based). Vercel's serverless runtime has an **ephemeral filesystem** — SQLite files don't persist across function invocations — so production needs a networked database. We use **Neon Postgres** (free tier, serverless, Prisma-native). The Prisma schema is identical between the two; only the `provider` line differs, and the deploy workflow swaps it automatically in CI without committing to your repo.

```
prisma/schema.prisma            ← SQLite (local dev)
prisma/schema.postgres.prisma   ← Postgres (production, identical models)
```

### Step-by-step first deployment

#### 1. Create the GitHub repository

```bash
# From the project root
git init
git add .
git commit -m "Initial: Agricultural Insurance System"
git branch -M main
git remote add origin https://github.com/<your-org>/livecrop-Insurance.git
git push -u origin main
```

#### 2. Create a Neon Postgres database

1. Go to https://neon.tech and sign up (free tier, no credit card).
2. Create a new project — call it `livecrop-insurance`.
3. Copy the **connection string** (looks like `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`).
4. Initialize the schema by running the helper script locally:

   ```bash
   ./scripts/setup-prod-db.sh "postgresql://user:pass@ep-xxx...neon.tech/neondb?sslmode=require"
   ```

   This temporarily swaps the Prisma schema to Postgres, runs `prisma db push` to create all 9 tables in your Neon DB, then restores the SQLite schema for local dev.

#### 3. Create the Vercel project

1. Go to https://vercel.com and sign in with GitHub.
2. **Add New → Project** → import your `livecrop-Insurance` repo.
3. Framework preset: **Next.js** (auto-detected).
4. **Don't deploy yet** — first set environment variables (next step).
5. Go to **Settings → Environment Variables** and add:
   | Name | Value | Environments |
   |---|---|---|
   | `DATABASE_URL` | `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require` | Production, Preview, Development |
6. Go to **Settings → General** and copy your **Project ID** and **Org/Team ID** (also visible in `.vercel/project.json` after running `vercel link` locally).

#### 4. Add GitHub Actions secrets

In your GitHub repo, go to **Settings → Secrets and variables → Actions → New repository secret** and add these four:

| Secret name | Where to find the value |
|---|---|
| `VERCEL_TOKEN` | https://vercel.com/account/tokens → Create Token (scope: Full Account) |
| `VERCEL_ORG_ID` | Vercel dashboard → your team settings, or run `vercel link` locally and read `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | Same as above — `projectId` field in `.vercel/project.json` |
| `DATABASE_URL` | The Neon connection string from step 2 |

> 🔒 **Never commit these values to the repo.** GitHub secrets are encrypted at rest and never appear in logs.

#### 5. Push to trigger the deploy

```bash
git push origin main
```

This triggers two workflows:

- **CI** (`.github/workflows/ci.yml`) — runs on every PR and push: lint, type-check, build with a throwaway SQLite DB. No secrets required.
- **Deploy** (`.github/workflows/deploy.yml`) — runs on push to `main`:
  1. Installs deps
  2. Swaps Prisma schema to `postgresql` in CI (does NOT commit)
  3. Runs `prisma db push` against your Neon DB (idempotent — safe on every deploy)
  4. Builds with `vercel build --prod`
  5. Deploys the prebuilt artifacts to Vercel

Watch progress under the **Actions** tab in GitHub. When the deploy job finishes, your app is live at `https://livecrop-insurance.vercel.app` (or whatever Vercel assigned).

#### 6. Seed the production database (one-time)

The seed script uses SQLite-specific defaults, so for production you'll want to run it against the Postgres DB. Easiest path:

```bash
# Locally, swap to Postgres schema temporarily
cp prisma/schema.postgres.prisma prisma/schema.prisma

# Run the seed against the production DB
DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require" \
  bun run scripts/seed.ts

# Restore the SQLite schema for local dev
cp prisma/schema.sqlite.bak prisma/schema.prisma  # if you made a backup
# or just: git checkout prisma/schema.prisma
```

---

## 📋 Environment variables reference

| Variable | Required | Purpose | Example |
|---|---|---|---|
| `DATABASE_URL` | ✅ | Prisma connection string. SQLite for local dev, Postgres for production. | `file:./db/custom.db` (dev) / `postgresql://...` (prod) |
| `NEXTAUTH_URL` | ❌ | Only if you wire up NextAuth later | `https://livecrop-insurance.vercel.app` |
| `NEXTAUTH_SECRET` | ❌ | Only if you wire up NextAuth later | `openssl rand -base64 32` |

---

## 🗂 Project structure

```
.
├── .github/workflows/
│   ├── ci.yml                 # Lint + type-check + build on PR
│   └── deploy.yml             # Vercel deploy on push to main
├── prisma/
│   ├── schema.prisma          # SQLite — local dev
│   └── schema.postgres.prisma # Postgres — production (identical models)
├── scripts/
│   ├── seed.ts                # Demo data seeder (idempotent)
│   └── setup-prod-db.sh       # One-shot prod DB initializer
├── src/
│   ├── app/
│   │   ├── api/               # 10 API route groups (farmers, plots, livestock, ...)
│   │   ├── layout.tsx
│   │   └── page.tsx           # Single-page UI with 7 tabs
│   ├── components/agri/       # Per-tab UI components
│   └── lib/                   # loss-engine, spatial, muzzle, ndvi-simulator, db
├── .env.example
├── .nvmrc                     # Node 22 LTS
├── vercel.json                # Build config
└── package.json
```

---

## 🔧 Operations

### Run database migrations on production
The deploy workflow runs `prisma db push` on every deploy, so schema changes are applied automatically. For more controlled migrations (e.g. renames, data backfills), use Prisma Migrate:

```bash
# Locally, against the prod DB
cp prisma/schema.postgres.prisma prisma/schema.prisma
DATABASE_URL="postgresql://..." bun run db:migrate --name describe_the_change
git add prisma/migrations/ && git commit -m "db: describe the change"
git push  # deploy workflow will run `prisma migrate deploy` instead of db push
cp prisma/schema.sqlite.bak prisma/schema.prisma  # restore dev
```

### Re-run the seed
```bash
# Local dev
bun run scripts/seed.ts

# Production (be careful — clears existing data!)
cp prisma/schema.postgres.prisma prisma/schema.prisma
DATABASE_URL="postgresql://..." bun run scripts/seed.ts
git checkout prisma/schema.prisma
```

### View production logs
- **Vercel logs**: Vercel dashboard → your project → Logs tab. Filter by `Runtime: Function` for API route logs.
- **GitHub Actions**: repo → Actions tab → click any workflow run for step-by-step logs.
- **Neon logs**: Neon dashboard → your project → SQL Editor → query any table to inspect data.

---

## ⚠️ Mock implementations (production caveats)

These features are simulated for the demo. Before going live, replace each with the real backend per the implementation plan:

| Feature | Mock in this demo | Production target |
|---|---|---|
| **Muzzle biometrics** | 512-dim embedding derived from tag ID via FNV-1a hash | Real CNN inference on muzzle photos (e.g. PyTorch MobileNet) |
| **Sentinel-2 NDVI** | Simulated seasonal curve with Gaussian noise | Real Sentinel-2 L2A imagery via Copernicus Data Space or Sinergise Sentinel Hub |
| **Mobile money** | 90/10 random success with mock references | Real M-Pesa Daraja API, MTN MoMo API, Airtel Money API |
| **Spatial overlap** | turf.js `booleanOverlap` in JS | PostGIS `ST_Intersects` with a GIST spatial index |
| **Authentication** | None (open access) | NextAuth.js with OAuth2/JWT per the plan |

---

## 📜 License

Internal — Enterprise Architecture Office. See the Implementation Plan PDF for sign-off and approval details.
