# Deployment Guide — GHCR + Dokploy

Bedrock больше не собирает образы на Dokploy-хосте. Теперь сборка живёт в
GitHub Actions, готовые образы лежат в `ghcr.io/deathpresence`, а Dokploy
только pull'ит и переподнимает контейнеры через webhook.

## Архитектура

```
push → main
   │
   ▼
GitHub Actions (.github/workflows/release-images.yml)
   ├─ matrix: api / crm / finance / portal / workers / db
   ├─ docker buildx build --push
   │     ghcr.io/deathpresence/bedrock-<app>:latest
   │     ghcr.io/deathpresence/bedrock-<app>:sha-<short>
   └─ curl POST ${DOKPLOY_WEBHOOK_URL}
                  │
                  ▼
             Dokploy host
                  ├─ docker compose pull
                  └─ docker compose up -d
```

- `latest` всегда указывает на последний зелёный build с `main`.
- `sha-<short>` — неизменяемый тег конкретного коммита, используется для
  пин-деплоя и отката.
- `tigerbeetle` по-прежнему билдится локально из `infra/tigerbeetle/` —
  Dockerfile это тонкий wrapper поверх официального образа, registry для
  него избыточен.

## Однократная настройка

### 1. Настройки GitHub-репозитория

**Permissions → Actions → General → Workflow permissions:**
- "Read and write permissions" (или хотя бы write на packages).

**Secrets and variables → Actions → Secrets:**
- `DOKPLOY_WEBHOOK_URL` — webhook redeploy из Dokploy (раздел ниже). Без
  него workflow отрабатывает до push, но Dokploy не перезапускает стек
  (в логах появится `::warning::DOKPLOY_WEBHOOK_URL secret not set`).

Первый раз образы публикуются в `ghcr.io/deathpresence` как приватные.
После первой успешной сборки нужно прийти на
<https://github.com/users/deathpresence/packages> и убедиться, что пакеты
привязаны к репозиторию (GitHub это делает автоматически по
`repository.url` из Dockerfile или label, но проверить лишним не будет).

### 2. Ghcr creds на Dokploy-хосте

Образы приватные — хосту нужен pull-токен. Две опции:

**Option A — через Dokploy UI (рекомендуется).**
1. В Dokploy: *Settings → Registries → Add Registry*.
2. Registry URL: `ghcr.io`.
3. Username: GitHub user, у которого есть доступ к пакетам
   (`deathpresence` или любой коллаборатор).
4. Password: Personal Access Token (classic) с scope `read:packages`.
   Создаётся на <https://github.com/settings/tokens>.
5. Привязать registry к приложению (compose) в его настройках.

**Option B — docker login на хосте.**
```bash
ssh <dokploy-host>
echo "<PAT>" | docker login ghcr.io -u <github-user> --password-stdin
```
Записывает creds в `/root/.docker/config.json` — Dokploy подхватит.

### 3. Dokploy application, указывающее на compose

В Dokploy создаём Docker Compose application:
- Source: Git → этот репозиторий, ветка `main`.
- Compose path: `infra/docker-compose.prod.yml`.
- Environment: залить production `.env` через UI (DB_*, TB_*,
  BETTER_AUTH_SECRET, DRIZZLE_MASTERPASS, S3_*, OPENAI_API_KEY,
  RESEND_API_KEY и т.д. — полный список видно в compose).
- Дополнительно выставить `IMAGE_TAG=latest` (необязательно, это default,
  но явная запись позволяет быстро переключать через env).
- Auto Deploy: **выключен**. Redeploy идёт строго через webhook из GHA,
  иначе будет гонка "Dokploy вытащил старый commit пока образы ещё
  собираются".

### 4. Dokploy webhook

Там же, в настройках application: *Deployments → Webhook → Copy URL*.
Скопировать в GitHub secret `DOKPLOY_WEBHOOK_URL`. Это единственный канал,
которым GHA инициирует `docker compose pull && up -d`.

## Релизный цикл

### Обычный деплой (push в main)
1. Merge PR в `main`.
2. Workflow `Release Images` запускается автоматически.
3. 6 matrix-job'ов собирают образы и пушат `:latest` + `:sha-<commit>`.
4. Финальный job `notify-dokploy` дергает webhook.
5. Dokploy: `docker compose pull && docker compose up -d`.
   Init-контейнеры (`db-migrate`, `db-seed`) отрабатывают в порядке
   `depends_on` и выходят; длинные сервисы рестартуют с новым образом.

### Ручной релиз (workflow_dispatch)
Actions → `Release Images` → *Run workflow*. Можно указать
`extra_tag` — например `rc-2026-04-14` или `hotfix-oauth` — образы будут
помечены и им, помимо стандартных. Webhook при `workflow_dispatch` **не
вызывается** — переключение версии делаем сознательно (см. ниже).

### Первый bootstrap (когда ещё ни одного образа нет в ghcr)
Не мерджите compose-изменения сразу — иначе Dokploy попытается pull
образ, которого ещё нет. Порядок:
1. Запустить `Release Images` руками через *Run workflow* на
   `main`-ветке (или любой временной ветке, где лежит workflow).
2. Дождаться зелёного — в ghcr появятся 6 репозиториев.
3. **Тогда** мерджить commit, который переключает `infra/docker-compose.prod.yml`
   на `image:`, и дергать `Redeploy` в Dokploy.

## Откат

Два способа:

**Быстрый — поменять `IMAGE_TAG`:**
1. В Dokploy → application → Environment → выставить
   `IMAGE_TAG=sha-<commit-который-работал>`.
2. Нажать Redeploy.

**Через webhook с фиксацией тега:** можно сделать через GH
`workflow_dispatch` с известным `extra_tag`, а потом руками поставить
этот тег в Dokploy. Но в большинстве случаев первый путь проще.

Теги `sha-<short>` не перезаписываются, так что rollback детерминирован.

## Проверка, что всё работает

После того как image успешно в ghcr — проверить локально с production
compose (образ приватный, значит docker login нужен и локально):

```bash
docker login ghcr.io -u <your-user>
IMAGE_TAG=latest docker compose -f infra/docker-compose.prod.yml pull
IMAGE_TAG=latest docker compose -f infra/docker-compose.prod.yml config --quiet
```

Первая команда должна скачать образы, вторая — валидация compose без
поднятия контейнеров.

## Troubleshooting

- **GHA падает на `docker/login-action`, 403 write:packages.**
  Repository Settings → Actions → Workflow permissions → "Read and write
  permissions". Или у репо выключено разрешение публиковать packages;
  включи на организационном уровне.
- **GHA падает на push: `unauthorized: authentication required`.**
  То же самое — токена `GITHUB_TOKEN` не хватает `write:packages`.
- **Dokploy не pull'ит: `pull access denied for ghcr.io/...`.**
  Не залогинен. Сделать Option A или Option B из раздела 2.
- **Dokploy pull'ит, но сервис стартует со старой версией.**
  Поверь в `docker inspect bedrock-api | grep Image` — если `Image`
  ссылается на старый digest, значит `docker compose up -d` посчитал, что
  ничего не менялось. Решение: использовать `docker compose up -d
  --pull always` или `docker compose pull` перед `up -d`.
  В Dokploy это настраивается в команде redeploy.
- **Next.js apps показывают старые URL-ы / title.**
  `NEXT_PUBLIC_*` переменные запечены в образе на этапе `next build`.
  Чтобы поменять, нужно отредактировать `build_args` в
  `.github/workflows/release-images.yml` и выкатить новый build.
  Перезапуск контейнера без rebuild ничего не даст.
- **Webhook 200, но Dokploy молчит.**
  Проверь в Dokploy UI логи deployment — если там ничего нет, webhook
  секрет устарел (Dokploy периодически ротирует). Пересоздать и обновить
  secret в GitHub.
