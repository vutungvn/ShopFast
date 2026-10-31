#!/usr/bin/env bash
# Chạy trên EC2 mỗi khi GitHub Actions SSH vào bằng khoá deploy (khoá này chỉ được chạy đúng script này).
# Kéo code mới nhất của main, build lại image, chạy migration, khởi động lại, rồi kiểm tra api.
set -euo pipefail

cd /opt/shopfast
export COMPOSE_FILE=docker-compose.prod.yml:docker-compose.https.yml
export COMPOSE_ENV_FILES=.env.prod

# Hai lần deploy không chạy chồng lên nhau
exec 9>/tmp/shopfast-deploy.lock
flock 9

echo "==> Kéo code mới nhất của main"
git fetch --quiet origin main
git reset --hard --quiet origin/main      # .env.prod không nằm trong git nên không bị ảnh hưởng

echo "==> Build và khởi động lại (migration chạy trước api)"
docker compose up -d --build --remove-orphans

echo "==> Chờ api healthy"
for _ in $(seq 1 30); do
  if [ "$(docker inspect -f '{{.State.Health.Status}}' shopfast-prod-api-1)" = healthy ]; then
    docker image prune -f >/dev/null
    echo "==> Deploy xong: $(git rev-parse --short HEAD)"
    exit 0
  fi
  sleep 5
done

echo "==> api không healthy sau 150 giây" >&2
docker compose logs --tail 50 migrate api >&2
exit 1
