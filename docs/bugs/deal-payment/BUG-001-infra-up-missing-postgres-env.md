# BUG-001 — `infra:up` starts Postgres without DB env and breaks reset

Severity: blocker
Layer: unknown
URL: local infra bootstrap
Step: environment setup before CRM login

## Repro

1. Run `bun run infra:up` from the repo root in a fresh shell.
2. Observe Docker Compose warnings that `DB_USER`, `DB_PASSWORD`, and `DB_NAME` are not set.
3. Run `bun run deal-payment:reset-db`.
4. Observe Postgres init/reset failures before the UI run can start.

## Expected

`bun run infra:up` should bring up Postgres with the repo's configured DB env values so `bun run deal-payment:reset-db` can connect to `localhost:5432` and complete deterministically.

## Actual

Postgres was recreated with blank env vars, logged that the database was uninitialized and no superuser password was specified, and the first reset attempts failed with connection termination and `ECONNREFUSED`.

## Evidence

- artifact: [00-setup-postgres-error.txt](/Users/alexey.eramasov/dev/ledger/artifacts/deal-a/20260413-114218/00-setup-postgres-error.txt)
- run report: [deal-payment-run.md](/Users/alexey.eramasov/dev/ledger/docs/bugs/deal-payment-run.md)

## Likely owner

Local repo bootstrap / Docker Compose wrapper around `infra/docker-compose.dev.yml`

## Suggested fix

Change the bootstrap to pass `.env` explicitly into Docker Compose, for example `docker compose --env-file .env -f infra/docker-compose.dev.yml up -d`, and gate `deal-payment:reset-db` on Postgres readiness.
