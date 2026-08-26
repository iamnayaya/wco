#!/usr/bin/env bash
# Bootstrap a fresh WCO dev environment on Windows/macOS/Linux.
# Prereqs: Node 20+, Docker Desktop, git.
set -euo pipefail

echo "==> 1/6 Checking prerequisites..."
command -v node >/dev/null || { echo "Node.js 20+ required"; exit 1; }
command -v docker >/dev/null || { echo "Docker required"; exit 1; }

NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Node >= 20 required (found $(node -v))"; exit 1
fi

echo "==> 2/6 Installing workspace dependencies..."
npm install

echo "==> 3/6 Starting infrastructure (Postgres, Redis, RabbitMQ)..."
docker compose -f infra/docker/docker-compose.yml up -d postgres redis rabbitmq

echo "==> 4/6 Waiting for Postgres to accept connections..."
until docker compose -f infra/docker/docker-compose.yml exec -T postgres pg_isready -U wco >/dev/null 2>&1; do
  sleep 1
done

echo "==> 5/6 Applying database migrations + seed data..."
npm run db:migrate:deploy --workspace=@wco/database
npm run db:seed --workspace=@wco/database

echo "==> 6/6 Copying env template..."
[ -f .env ] || cp .env.example .env

cat <<'EOF'
Done! Start developing:

  npm run dev          # all services via turbo
  # or individually:
  npm run dev --workspace=@wco/backend
  npm run dev --workspace=@wco/frontend

Default URLs:
  API        http://localhost:4000/api/v1
  Web app    http://localhost:3000
  AI engine  http://localhost:5000/health
EOF
