# Deployment Guide — GHCR + Dokploy

Bedrock больше не собирает образы на Dokploy-хосте. Теперь сборка живёт в
GitHub Actions, готовые образы лежат в `ghcr.io/mpayments`, а Dokploy
только pull'ит и переподнимает контейнеры через webhook.

## Архитектура

```
push → main
   │
   ▼
GitHub Actions (.github/workflows/release-images.yml)
   ├─ matrix: api / crm / finance / portal / workers / db
   ├─ docker buildx build --push
   │     ghcr.io/mpayments/bedrock-<app>:latest
   │     ghcr.io/mpayments/bedrock-<app>:sha-<short>
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

Важно: namespace — **organization** `MPayments` (в URL-ах ghcr — lowercase
`mpayments`). Это важно, потому что для org-namespace `GITHUB_TOKEN`
workflow'а имеет достаточно прав для push через GitHub App installation.
Для личного user-namespace пришлось бы заводить PAT — тут не надо.

**Organization settings → Packages:**
- Убедиться, что в *Settings → Actions → General → Workflow permissions*
  для репо включено "Read and write permissions" (или explicit
  `packages: write` в workflow — у нас он уже выставлен).
- Если в организации включён policy "Restrict publishing to public
  visibility" — ок, мы всё равно публикуем приватно.

Первая успешная сборка автоматически создаст 6 packages и привяжет их к
репозиторию через `org.opencontainers.image.source` (устанавливается
`docker/build-push-action` по default). После этого на
<https://github.com/orgs/MPayments/packages> появятся `bedrock-api`,
`bedrock-crm`, `bedrock-finance`, `bedrock-portal`, `bedrock-workers`,
`bedrock-db` — все private.

Если после первого билда какой-то package остался **не** привязанным к
репо (редко, но бывает при ручном предварительном push'е): зайти в
*Package settings → Manage Actions access → Add repository →
MPayments/bedrock → Role: Write*.

### 2. Ghcr creds на Dokploy-хосте

Образы приватные — хосту нужен pull-токен. Две опции:

**Option A — через Dokploy UI (рекомендуется).**
1. В Dokploy: *Settings → Registries → Add Registry*.
2. Registry URL: `ghcr.io`.
3. Username: GitHub user, у которого есть доступ к пакетам организации
   MPayments (любой member с пакет-правами, например `deathpresence`).
4. Password: Personal Access Token (classic) с scope `read:packages`.
   Создаётся на <https://github.com/settings/tokens>. Для fine-grained
   PAT — Account permission "Packages: Read-only" в resource owner
   MPayments.
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
  permissions".
- **GHA падает на push с `denied: permission_denied: The requested
  installation does not exist`.**
  Такое бывает, если кто-то в прошлом запускал этот workflow под
  **личным** namespace (`ghcr.io/<user>/...`) — для user-packages
  `GITHUB_TOKEN` не работает (app installation отсутствует). Сейчас
  workflow использует org `mpayments` — должно работать. Если ошибка
  всплывёт снова, проверь `IMAGE_OWNER` в workflow и org policy
  `Settings → Packages`.
- **GHA падает на push: `unauthorized: authentication required`.**
  Токена `GITHUB_TOKEN` не хватает `write:packages`. Проверить
  `permissions:` блок в workflow и workflow-permissions на уровне репо.
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

## Идеи на будущее

### Тег-ориентированный релиз через GHA

Сейчас на каждый push в `main` собираются образы, а промоушен в
`multihansa-prod` (и прочие prod-ветки) делается руками. Это даёт риск
гонки "push в prod опередил сборку" и заставляет помнить порядок
действий.

Альтернатива: использовать git-теги как триггер релиза.

```
git tag v0.0.1 → push
   │
   ▼
GHA .github/workflows/release-on-tag.yml
   ├─ собирает образы, тегирует их :v0.0.1 + :sha-<short> + :latest
   ├─ дожидается зелёной сборки всех матрикс-job'ов
   └─ пушит коммит с тегом (или обновляет IMAGE_TAG=v0.0.1 в
      infra/docker-compose.prod.yml) в ветку multihansa-prod
          │
          ▼
      Dokploy auto-deploy срабатывает УЖЕ ПОСЛЕ того, как образы
      гарантированно в реестре — гонка исключена.
```

Преимущества:
- Релиз становится явным событием (семвер-тег), а не побочным
  эффектом мерджа в main.
- `IMAGE_TAG` в compose пинится на конкретную версию, а не на
  `:latest` → docker видит смену тега → `--pull always` можно убрать,
  pull сработает автоматически.
- Откат = `git tag v0.0.1 → push multihansa-prod` с прошлым тегом.
- Можно иметь несколько prod-веток (`multihansa-prod`, `client-x-prod`,
  `staging`) и решать через GHA-inputs, в какие из них промоутить
  этот тег.

Минусы:
- Нужна дисциплина: кто и когда создаёт тег. Можно завязать на
  GitHub Release UI, чтобы этим занимались не только разработчики.
- Мерж в `main` перестаёт быть "деплоем" — для части команды это
  ментальный сдвиг.
