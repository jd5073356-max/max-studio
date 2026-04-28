#!/bin/bash
# EC2 stability setup — run once as ubuntu user with sudo
# Usage: bash infra/setup-ec2.sh

set -e

echo "=== MAX Studio EC2 Setup ==="

# ── 1. Swap de 2GB (crítico en t3.micro) ─────────────────────────────────────
if [ ! -f /swapfile ]; then
  echo "[swap] Creando swapfile de 2GB..."
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  echo "[swap] ✓ Swap activo: $(free -h | grep Swap)"
else
  echo "[swap] ✓ Ya existe swapfile"
fi

# ── 2. Instalar Docker si no está ────────────────────────────────────────────
if ! command -v docker &> /dev/null; then
  echo "[docker] Instalando Docker..."
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker ubuntu
  sudo systemctl enable docker
  sudo systemctl start docker
  echo "[docker] ✓ Instalado"
else
  echo "[docker] ✓ Ya instalado: $(docker --version)"
fi

# ── 3. Instalar docker-compose v2 si no está ─────────────────────────────────
if ! docker compose version &> /dev/null; then
  echo "[compose] Instalando docker compose plugin..."
  sudo apt-get update -qq
  sudo apt-get install -y docker-compose-plugin
fi
echo "[compose] ✓ $(docker compose version)"

# ── 4. Clonar / actualizar repo ───────────────────────────────────────────────
REPO_DIR="$HOME/max-studio"
if [ ! -d "$REPO_DIR/.git" ]; then
  echo "[git] Clona el repo manualmente en $REPO_DIR y re-ejecuta este script"
  exit 1
fi

cd "$REPO_DIR"
git pull origin main
echo "[git] ✓ Repo actualizado"

# ── 5. Levantar gateway ───────────────────────────────────────────────────────
echo "[gateway] Levantando con docker compose..."
docker compose -f infra/docker-compose.gateway.yml up -d --build

echo ""
echo "=== Setup completo ==="
echo "  Gateway: http://localhost:8003/health"
echo "  Logs:    docker logs -f max-gateway"
echo "  Restart: docker compose -f infra/docker-compose.gateway.yml restart"
echo "  RAM:     free -h"
echo "  Swap:    swapon --show"
