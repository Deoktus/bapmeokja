# 밥 뭐먹지?

만다라트(3×3) 메뉴 지도로 메뉴 범위를 고르거나 랜덤으로 뽑아 주변 식당을 찾는 3티어 앱.
앱 자체보다 **VM 직접 설치 → Docker Compose → Kubernetes** 배포 경험이 목적인 개인 프로젝트다.

| 티어 | 폴더 | 기술 |
|---|---|---|
| 웹 | `web/` | React (Vite) |
| API | `api/` | Node.js (Express 5) |
| DB | - | PostgreSQL 16 |

식당 검색은 현재 **모의 데이터**(`api/src/places.js`)다. 같은 시그니처의 함수로 바꾸면 실제 API를 붙일 수 있다.

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/health` | DB 연결까지 확인하는 상태 점검 |
| GET | `/api/menus?alcohol=true\|false` | 대분류 8개 × 메뉴 8칸. `alcohol=true`면 일부 칸이 술 메뉴로 대체됨 |
| POST | `/api/picks` | `{ "menuItemId": 1 }` — 익명 선택 횟수 +1 |
| GET | `/api/places?keyword=&lat=&lng=&radius=` | 반경(500·1000·2000m) 내 식당 |

사용자·위치 정보는 저장하지 않는다. DB에는 메뉴 트리와 메뉴별 선택 횟수만 있다.

## 1단계: 로컬 실행

```bash
# 1) DB (데이터는 bapmeokja-pgdata 볼륨에 남는다)
docker run -d --name bapmeokja-db \
  -e POSTGRES_USER=bapmeokja -e POSTGRES_PASSWORD=<비밀번호> -e POSTGRES_DB=bapmeokja \
  -p 5432:5432 -v bapmeokja-pgdata:/var/lib/postgresql/data postgres:16-alpine

# 2) API — api/.env.example 을 api/.env 로 복사해 DB_PASSWORD 를 맞춘다
cd api && npm install && npm run dev

# 3) 웹 (다른 터미널) — http://localhost:5173
cd web && npm install && npm run dev
```

API는 시작할 때 DB에 연결될 때까지 기다린 뒤, 테이블 구조(스키마)와 기본 메뉴 데이터를 만든다.
이미 있는 것은 새로 만들지 않고 갱신만 하므로, 몇 번을 다시 시작해도 결과가 같다(멱등).
DB 접속 정보는 모두 환경 변수(`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `PORT`)로 받으며, `.env` 는 Git에 올리지 않는다.

테스트: `cd api && npm test`

## 2단계: VM에 직접 설치 (Ubuntu 24.04)

```
 브라우저 ─► Nginx 127.0.0.1:8088 ──┬─ /     → /var/www/bapmeokja (빌드한 웹 파일)
                                    └─ /api/ → API 127.0.0.1:3000 (systemd) ─► PostgreSQL 127.0.0.1:5432
```

설정 파일은 `deploy/vm/`에 있다. 이 VM은 80번 포트를 쿠버네티스 Ingress가 쓰고 있어서 Nginx는 8088번을 쓴다.

```bash
# 1) 설치 — Nginx 기본 사이트는 80번을 쓰므로 제거한다
sudo apt-get install -y nginx postgresql
sudo rm /etc/nginx/sites-enabled/default

# 2) DB 계정·데이터베이스 생성, 접속 정보 파일 작성 (비밀번호는 무작위 생성, 화면에 출력하지 않는다)
PW=$(openssl rand -hex 24)
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
CREATE ROLE bapmeokja LOGIN PASSWORD '$PW';
CREATE DATABASE bapmeokja OWNER bapmeokja;
SQL
sudo install -d -m 755 /etc/bapmeokja
sudo tee /etc/bapmeokja/api.env >/dev/null <<ENV
PORT=3000
HOST=127.0.0.1
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=bapmeokja
DB_PASSWORD=$PW
DB_NAME=bapmeokja
ENV
sudo chmod 600 /etc/bapmeokja/api.env; unset PW

# 3) API — 재부팅해도 다시 뜨도록 systemd 서비스로 등록
(cd api && npm ci --omit=dev)
sudo cp deploy/vm/bapmeokja-api.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now bapmeokja-api

# 4) 웹 — 빌드한 파일을 Nginx가 읽을 수 있는 위치에 두고 설정을 켠다
(cd web && npm ci && npm run build)
sudo install -d /var/www/bapmeokja && sudo cp -r web/dist/. /var/www/bapmeokja/
sudo cp deploy/vm/nginx-bapmeokja.conf /etc/nginx/sites-available/bapmeokja
sudo ln -s /etc/nginx/sites-available/bapmeokja /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl enable --now nginx
```

확인: `curl localhost:8088/api/health`, API 프로세스를 `kill -9` 해도 3초 안에 다시 뜬다. 브라우저는 VS Code **PORTS 탭**에서 8088번을 전달해서 연다.

## 3단계: Docker Compose

```bash
cp .env.example .env          # DB_PASSWORD 를 안전한 값으로 바꾼다 (.env 는 Git에 올리지 않는다)
docker compose up -d --build  # web · api · db 한 번에 실행 → http://localhost:8088
docker compose down           # 중지 (데이터는 pgdata 볼륨에 남는다. 지우려면 down -v)
```

| 서비스 | 이미지 | 비고 |
|---|---|---|
| web | nginx-unprivileged (빌드 결과만 포함) | 호스트 `127.0.0.1:8088` 에만 공개, 비루트, 읽기 전용 |
| api | node:24-alpine | 공개 포트 없음, 비루트, 읽기 전용, 권한 전부 제거, npm 제거 |
| db | postgres:16-alpine | 공개 포트 없음, 데이터는 `pgdata` 볼륨 |

- web 의 Nginx 는 시작할 때 `api` 이름을 한 번만 해석한다. api 컨테이너만 다시 만들었다면 `docker compose restart web` 이 필요하다.
- 이미지 취약점 점검: `docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image --severity HIGH,CRITICAL bapmeokja-api`

## 4단계: Kubernetes (VM의 kind 클러스터 `lab`)

전용 네임스페이스 `bapmeokja`에 올리며, 다른 실습 리소스는 건드리지 않는다. 네임스페이스에는 파드 보안 등급 `restricted`가 걸려 있다.

```
 Ingress (traefik, bapmeokja.localhost)
   ├─ /api ─► Service api ─► Deployment api (2) ─┐
   └─ /    ─► Service web ─► Deployment web (2)  ├─► Service db ─► StatefulSet db (1) ─► PVC 1Gi
                                                  │
        ConfigMap app-config (비밀 아닌 설정) · Secret db-credentials (DB 비밀번호)
```

```bash
# 이미지를 단일 구조(x86) 파일로 저장해 클러스터에 넣는다
# (kind load docker-image 는 새 Docker의 멀티 구조 이미지에서 "content digest not found" 로 실패했다)
docker tag bapmeokja-api:latest bapmeokja-api:0.1.1 && docker tag bapmeokja-web:latest bapmeokja-web:0.1.0
docker save --platform linux/amd64 -o /tmp/images.tar bapmeokja-api:0.1.1 bapmeokja-web:0.1.0 postgres:16-alpine
kind load image-archive /tmp/images.tar --name lab && rm /tmp/images.tar

kubectl apply -f k8s/00-namespace.yaml
kubectl -n bapmeokja create secret generic db-credentials --from-env-file=.env   # DB_PASSWORD 한 줄짜리 .env
kubectl apply -f k8s/
kubectl -n bapmeokja get pods
```

확인: `curl http://bapmeokja.localhost/api/health` (VM 안에서). 브라우저는 VS Code **PORTS 탭에서 80번 포트를 전달**한 뒤 `http://bapmeokja.localhost:<전달된 포트>` 로 연다. `*.localhost` 이름은 Chrome이 자동으로 로컬로 해석한다.

- 호스트 규칙(`bapmeokja.localhost`)이 있어서 다른 호스트 이름(grafana.localhost, shop.localhost 등)의 요청은 이 앱으로 오지 않는다.
- 정리: `kubectl delete namespace bapmeokja` (PVC까지 함께 지워진다).

