# DEAL-PAYMENT-AED-USD

Purpose: verify that a CRM operator and a finance operator can drive the canonical `payment` deal from CRM draft creation through finance documents, treasury execution, reconciliation readiness, and final close.

Preconditions:

- local infra is running
- the DB has been reset with `bun run deal-payment:reset-db`
- the app stack is running with `bun run deal-payment:start-stack`
- the seeded operator account exists: `operator@bedrock.com` / `operator123`
- the invoice fixture exists at `tests/e2e/fixtures/invoice.pdf`

Steps:

1. Open CRM and log in as the seeded operator.
2. Open the deal list and start a new deal.
3. Choose customer `White Pride`.
4. Choose acting legal entity `WHITE PRIDE LLC`.
5. Choose the active agreement `WP-AFA-2026-001`.
6. Choose deal type `Payment`.
7. Set source currency to `AED` and payout currency to `USD`.
8. Fill the beneficiary as `Almutlag` plus the required payment, invoice, and bank fields.
9. Save the draft.
10. Open the documents tab.
11. Upload `tests/e2e/fixtures/invoice.pdf` as an `Инвойс` attachment.
12. Move the deal from `Черновик` to `Отправлена`.
13. Open `Котировка и расчет` and request an AED -> USD quote.
14. Accept the returned quote.
15. Create the calculation from the accepted quote.
16. Move the deal to `Подготовка документов`.
17. In finance, create and post the opening `invoice` formal document.
18. In finance, request execution and settle the materialized treasury operations.
19. In finance, create and post the `exchange` document for the convert leg.
20. Resolve reconciliation artifacts for the linked operations.
21. In CRM, move the deal to `Ожидание средств`, then to `Ожидание оплаты`, then to `Закрывающие документы`.
22. In CRM, verify the `Сбор средств -> Конвертация -> Выплата` path reaches the expected terminal state for this run.
23. In finance, create the closing `acceptance` document.
24. In finance, close the deal.
25. Verify the deal status is `Завершена` in both finance and CRM.

Expected outcome:

- the draft is created successfully
- the operator lands on the created deal page
- the uploaded `invoice.pdf` attachment is visible in the documents workspace
- the deal can move to `Отправлена`
- the quote can be requested and accepted for the AED -> USD path
- the calculation can be created from the accepted quote
- the deal can move through `Подготовка документов`, `Ожидание средств`, `Ожидание оплаты`, and `Закрывающие документы`
- finance can create the opening `invoice` document and the convert-leg `exchange` document
- the linked treasury instructions can be settled for all legs
- the closing `acceptance` document can be created
- finance can close the deal and CRM reflects the terminal `Завершена` status

Current automation notes:

1. The Playwright flow creates reconciliation artifacts through a test-side helper because there is no operator-facing reconciliation UI in finance today.
2. The convert leg becomes finance-complete off the posted `exchange` document.
3. The run validates end-to-end closure at the deal status level in both apps.

Out of scope:

- real external pricing and bank integrations
- operator-facing reconciliation workflows beyond the internal test helper
- formal-document content correctness beyond successful create/post transitions
- OCR/attachment ingestion side effects beyond successful upload

Owning modules:

- `apps/crm`
- `@bedrock/deals`
- `@bedrock/agreements`
- `@bedrock/parties`
- `@bedrock/calculations`
- `@bedrock/files`
- `@bedrock/treasury`
- `@bedrock/reconciliation`
