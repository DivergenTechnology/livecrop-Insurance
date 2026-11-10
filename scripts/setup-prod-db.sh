#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────
# setup-prod-db.sh — Initialize or reset the production Postgres database
#
# Usage:
#   1. Make sure you have a Neon (or other Postgres) connection string
#      from https://neon.tech (free tier is fine).
#   2. Export DATABASE_URL in your shell, OR pass it as the first arg:
#        ./scripts/setup-prod-db.sh "postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require"
#   3. The script will:
#        - temporarily swap the Prisma schema to postgresql
#        - run `prisma db push` to create all tables
#        - restore the SQLite schema for local dev
# ──────────────────────────────────────────────────────────────────────────
set -euo pipefail

DB_URL="${1:-${DATABASE_URL:-}}"
if [ -z "$DB_URL" ]; then
  echo "ERROR: No DATABASE_URL provided."
  echo "Usage: $0 \"postgresql://user:pass@host/db?sslmode=require\""
  echo "   or:  export DATABASE_URL=... && $0"
  exit 1
fi

cd "$(dirname "$0")/.."
echo "→ Backing up local SQLite schema"
cp prisma/schema.prisma prisma/schema.sqlite.bak

trap 'echo "→ Restoring SQLite schema"; cp prisma/schema.sqlite.bak prisma/schema.prisma; rm prisma/schema.sqlite.bak' EXIT

echo "→ Switching to Postgres schema"
cp prisma/schema.postgres.prisma prisma/schema.prisma

echo "→ Running prisma generate"
DATABASE_URL="$DB_URL" bun run db:generate

echo "→ Pushing schema to production database"
DATABASE_URL="$DB_URL" bun run db:push

echo ""
echo "✅ Production database initialized."
echo "   Tables created in: $DB_URL"
echo "   Local SQLite schema restored for dev."
echo ""
echo "Next: set DATABASE_URL as a secret in your Vercel project settings"
echo "      and as a GitHub repo secret for the deploy workflow."
