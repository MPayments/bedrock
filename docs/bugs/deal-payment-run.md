# Payment deal E2E run

Date: 2026-05-01 21:09-21:40 MSK
Environment: local Codex Desktop thread, CRM `http://localhost:3002`, Finance `http://localhost:3001`, API `http://localhost:3000`
Accounts: CRM `operator@bedrock.com`, Finance `admin@bedrock.com`
Artifact directory: `/Users/alexey.eramasov/dev/ledger/artifacts/deal-payment/20260501-210951`
Deal: `95c869fe-f0e5-4c38-91ab-aed5e45607b4`
Run status: failed at finance close; CRM can still force terminal status

## Summary

The canonical AED -> USD payment deal flow mostly works through CRM intake, pricing, calculation creation, formal documents, and Finance step execution. The run created a `payment` deal for `White Pride`, accepted the quote, auto-linked calculation `9c5e1367-2634-4a6c-9975-21e4f20710c2`, materialized three execution legs, created all required formal documents, and completed all visible Finance steps.

The hard failure is at close readiness: Finance reconciliation stays pending after `/reconciliation/run`, no reconciliation rows are created, and `/close` returns 409. CRM still allows the operator to move the deal to `Завершена`, so the two apps disagree on close gating.

## Values checked

- CRM intake: payout `14,500.00 USD`, source currency `AED`, purpose `Payment for invoice WP-INV-2026-001`, beneficiary `Almutlag`.
- Quote UI: client debit/routing cost `53,251.25 AED`, beneficiary receives `14,500.00 USD`, market/client rate `3.6725`, net profit `0.00 AED`.
- Calculation DB: original amount `53,251.25 AED`, agreement fee `532.51 AED`, fee bps `100`, total debit `53,783.76 AED`, base total `14,500.00 USD`, total with fee in base `14,645.00 USD`.
- Finance invoice document: `WP-E2E-INV-2026-001`, `53,251.25 AED`, submitted and posted.
- Formal documents: `application` submitted/not-required, `invoice` submitted/posted, `acceptance` submitted/not-required and linked to the application and invoice.
- Finance runtime states: payin `completed`, quote execution `completed`, payout `completed`.

## Steps completed

1. Reset and seeded the local database with `bun run deal-payment:reset-db`.
2. Started API, CRM, Finance, Portal, and Workers directly after `deal-payment:start-stack` failed.
3. Logged into CRM and created a payment deal for `White Pride` / `WHITE PRIDE LLC` under `WP-AFA-2026-001`.
4. Filled payment intake values, including AED source currency, USD payout currency, invoice metadata, and beneficiary bank details.
5. Accepted pricing in CRM; the app created the quote, accepted it, linked the calculation, and materialized execution.
6. Advanced CRM statuses through `Отправлена`, `Подготовка документов`, `Ожидание средств`, `Ожидание оплаты`, and `Закрывающие документы`.
7. In Finance, completed visible step state transitions for payin, FX quote execution, and payout.
8. Created required formal documents from Finance document routes: application, invoice, and acceptance.
9. Verified Finance shows execution progress `3 / 3` and documents `Готово`.
10. Attempted Finance reconciliation and close.
11. Verified CRM can still transition to `Завершена`.

## Bugs found

- [BUG-20260501-001 — Finance reconciliation run does not create matches and close remains blocked](/Users/alexey.eramasov/dev/ledger/docs/bugs/deal-payment/BUG-20260501-001-finance-reconciliation-close-blocked.md)
- [BUG-20260501-002 — CRM can complete a deal while Finance close readiness rejects it](/Users/alexey.eramasov/dev/ledger/docs/bugs/deal-payment/BUG-20260501-002-crm-completes-while-finance-close-blocked.md)
- [BUG-20260501-003 — CRM terminal overview still reports missing uploaded invoice](/Users/alexey.eramasov/dev/ledger/docs/bugs/deal-payment/BUG-20260501-003-crm-terminal-invoice-upload-blocker.md)
- [BUG-20260501-004 — `deal-payment:start-stack` fails on `@bedrock/sdk-api-client` build](/Users/alexey.eramasov/dev/ledger/docs/bugs/deal-payment/BUG-20260501-004-start-stack-sdk-build-failure.md)
- [BUG-20260501-005 — documents period-close worker crashes every tick](/Users/alexey.eramasov/dev/ledger/docs/bugs/deal-payment/BUG-20260501-005-documents-period-close-worker-crash.md)
- Existing: [BUG-001 — `infra:up` starts Postgres without DB env and breaks reset](/Users/alexey.eramasov/dev/ledger/docs/bugs/deal-payment/BUG-001-infra-up-missing-postgres-env.md)

## Key artifacts

- CRM draft created: `/Users/alexey.eramasov/dev/ledger/artifacts/deal-payment/20260501-210951/11-draft-created.yaml`
- Pricing accepted: `/Users/alexey.eramasov/dev/ledger/artifacts/deal-payment/20260501-210951/16-after-accept-quote.yaml`
- Calculation DB check: `/Users/alexey.eramasov/dev/ledger/artifacts/deal-payment/20260501-210951/19-db-calculation.tsv`
- Finance execution complete: `/Users/alexey.eramasov/dev/ledger/artifacts/deal-payment/20260501-210951/33-finance-step3-completed.yaml`
- Formal document DB check: `/Users/alexey.eramasov/dev/ledger/artifacts/deal-payment/20260501-210951/64-db-documents.tsv`
- Finance close rejection: `/Users/alexey.eramasov/dev/ledger/artifacts/deal-payment/20260501-210951/60-finance-close-direct-response.json`
- CRM terminal transition: `/Users/alexey.eramasov/dev/ledger/artifacts/deal-payment/20260501-210951/62-crm-completed-attempt.yaml`
