#!/usr/bin/env bash
# StockOS — full VPS bootstrap (Ubuntu 22.04/24.04)
# Run as root: bash deploy.sh
set -euo pipefail

VPS_IP="${VPS_IP:-$(curl -4 -s ifconfig.me || hostname -I | awk '{print $1}')}"
STOCKOS_DIR="${STOCKOS_DIR:-/opt/stockos}"
SUPABASE_DIR="${SUPABASE_DIR:-/opt/supabase}"
REPO_URL="${REPO_URL:-}"

echo "==> VPS IP: ${VPS_IP}"

# ── 1. Base packages + Docker ───────────────────────────────────────────────
apt-get update -y
apt-get install -y ca-certificates curl git openssl ufw

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

# ── 2. Firewall ─────────────────────────────────────────────────────────────
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable || true

# ── 3. Self-hosted Supabase (Postgres + Auth + REST + Storage) ──────────────
if [ ! -d "${SUPABASE_DIR}/docker" ]; then
  git clone --depth 1 https://github.com/supabase/supabase "${SUPABASE_DIR}"
fi

cd "${SUPABASE_DIR}/docker"
if [ ! -f .env ]; then
  cp .env.example .env

  # Generate secrets
  JWT_SECRET="$(openssl rand -base64 48 | tr -d '\n=/+' | head -c 40)"
  POSTGRES_PASSWORD="$(openssl rand -hex 16)"
  DASHBOARD_PASSWORD="$(openssl rand -hex 12)"

  # Replace placeholders (portable sed)
  sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" .env
  sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD}|" .env
  sed -i "s|DASHBOARD_PASSWORD=.*|DASHBOARD_PASSWORD=${DASHBOARD_PASSWORD}|" .env
  sed -i "s|SITE_URL=.*|SITE_URL=http://${VPS_IP}|" .env
  sed -i "s|API_EXTERNAL_URL=.*|API_EXTERNAL_URL=http://${VPS_IP}|" .env
  sed -i "s|SUPABASE_PUBLIC_URL=.*|SUPABASE_PUBLIC_URL=http://${VPS_IP}|" .env
  # Skip inbox confirm on first deploy (change later if you add SMTP)
  if grep -q '^ENABLE_EMAIL_AUTOCONFIRM=' .env; then
    sed -i "s|ENABLE_EMAIL_AUTOCONFIRM=.*|ENABLE_EMAIL_AUTOCONFIRM=true|" .env
  else
    echo "ENABLE_EMAIL_AUTOCONFIRM=true" >> .env
  fi

  # Generate anon + service_role JWTs with the new secret (requires Node)
  if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  fi

  node <<'NODE'
const crypto = require('crypto');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const jwtSecret = (env.match(/^JWT_SECRET=(.*)$/m) || [])[1]?.trim();
if (!jwtSecret) throw new Error('JWT_SECRET missing');

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}
function sign(payload) {
  const header = b64url({ alg: 'HS256', typ: 'JWT' });
  const body = b64url(payload);
  const data = `${header}.${body}`;
  const sig = crypto.createHmac('sha256', jwtSecret).update(data).digest('base64url');
  return `${data}.${sig}`;
}
const now = Math.floor(Date.now() / 1000);
const exp = now + 60 * 60 * 24 * 365 * 10; // 10y
const anon = sign({ role: 'anon', iss: 'supabase', iat: now, exp });
const service = sign({ role: 'service_role', iss: 'supabase', iat: now, exp });
let out = env;
out = out.replace(/^ANON_KEY=.*$/m, `ANON_KEY=${anon}`);
out = out.replace(/^SERVICE_ROLE_KEY=.*$/m, `SERVICE_ROLE_KEY=${service}`);
fs.writeFileSync('.env', out);
console.log('Generated ANON_KEY and SERVICE_ROLE_KEY');
NODE
fi

docker compose pull
docker compose up -d

echo "==> Waiting for Supabase DB..."
sleep 20
docker compose ps

# ── 4. StockOS repo ─────────────────────────────────────────────────────────
if [ ! -d "${STOCKOS_DIR}/.git" ] && [ ! -d "${STOCKOS_DIR}/stockos-api" ]; then
  if [ -n "${REPO_URL}" ]; then
    git clone "${REPO_URL}" "${STOCKOS_DIR}"
  else
    echo "ERROR: Set REPO_URL=https://github.com/YOU/CRM-pROJECT.git or upload the repo to ${STOCKOS_DIR}"
    exit 1
  fi
fi

cd "${STOCKOS_DIR}/deploy/vps"
cp -n .env.example .env || true

# Pull secrets from Supabase .env into StockOS .env
SUPA_ENV="${SUPABASE_DIR}/docker/.env"
ANON_KEY="$(grep -E '^ANON_KEY=' "${SUPA_ENV}" | cut -d= -f2-)"
SERVICE_KEY="$(grep -E '^SERVICE_ROLE_KEY=' "${SUPA_ENV}" | cut -d= -f2-)"
JWT_SECRET="$(grep -E '^JWT_SECRET=' "${SUPA_ENV}" | cut -d= -f2-)"
PG_PASS="$(grep -E '^POSTGRES_PASSWORD=' "${SUPA_ENV}" | cut -d= -f2-)"

JWT_ACCESS="$(openssl rand -hex 32)"
JWT_REFRESH="$(openssl rand -hex 32)"
WEBHOOK="$(openssl rand -hex 24)"

cat > .env <<EOF
VPS_HOST=${VPS_IP}
FRONTEND_URL=http://${VPS_IP}
NEXT_PUBLIC_APP_URL=http://${VPS_IP}
NEXT_PUBLIC_API_URL=http://${VPS_IP}
NEXT_PUBLIC_SUPABASE_URL=http://${VPS_IP}
SUPABASE_URL=http://supabase-kong:8000

NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}
SUPABASE_JWT_SECRET=${JWT_SECRET}
SUPABASE_WEBHOOK_SECRET=${WEBHOOK}
SUPABASE_AUTO_APPROVE_SIGNUPS=true

DATABASE_URL=postgresql://postgres:${PG_PASS}@db:5432/postgres
DIRECT_DATABASE_URL=postgresql://postgres:${PG_PASS}@db:5432/postgres

JWT_ACCESS_SECRET=${JWT_ACCESS}
JWT_REFRESH_SECRET=${JWT_REFRESH}
BCRYPT_ROUNDS=12
EOF

# Detect Supabase docker network name
NET="$(docker network ls --format '{{.Name}}' | grep -E 'supabase' | head -n1 || true)"
if [ -z "${NET}" ]; then
  NET="$(docker network ls --format '{{.Name}}' | grep -E 'docker_default' | head -n1 || true)"
fi
echo "Supabase network: ${NET}"
# Patch compose external network name if needed
if [ -n "${NET}" ] && [ "${NET}" != "supabase_default" ]; then
  sed -i "s/supabase_default/${NET}/g" docker-compose.yml
fi

# ── 5. Apply StockOS SQL migrations into Postgres ───────────────────────────
echo "==> Applying stockos-web supabase migrations..."
DB_CID="$(docker ps --filter 'name=db' --format '{{.ID}}' | head -n1)"
if [ -n "${DB_CID}" ]; then
  for f in $(ls -1 "${STOCKOS_DIR}/stockos-web/supabase/migrations/"*.sql | grep -v rollback | sort); do
    echo "  -> $(basename "$f")"
    docker exec -i "${DB_CID}" psql -U postgres -d postgres < "$f" || true
  done
fi

# ── 6. Build & start StockOS ────────────────────────────────────────────────
docker compose up -d --build

echo ""
echo "=============================================="
echo " StockOS is starting on http://${VPS_IP}"
echo " API health: http://${VPS_IP}/health"
echo " Supabase Studio: http://${VPS_IP}:3000 (or check docker ports)"
echo "=============================================="
docker compose ps
