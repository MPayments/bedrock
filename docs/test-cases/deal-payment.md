# DEAL-PAYMENT-AED-USD

Purpose: verify that a CRM operator can create the canonical payment deal payment deal, attach the invoice PDF, request and accept an AED -> USD quote, create the calculation, and reach the expected execution path.

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
17. Open `Исполнение` and verify the `Сбор средств -> Конвертация -> Выплата` path.

Expected outcome:

- the draft is created successfully
- the operator lands on the created deal page
- the uploaded `invoice.pdf` attachment is visible in the documents workspace
- the deal can move to `Отправлена`
- the quote can be requested and accepted for the AED -> USD path
- the calculation can be created from the accepted quote
- the deal can move to `Подготовка документов`
- the execution workspace shows the expected `collect -> convert -> payout` sequence

Next steps for coverage expansion:

1. Recheck `Обзор` and assert that blockers move forward after quote acceptance and calculation creation.
2. Mark or validate the collection, conversion, and payout legs as they progress through `pending`, `ready`, `in_progress`, and `done`.
3. Revisit `Документы` and verify OCR / ingestion side effects and internal document generation if the local extractor and storage are configured.
4. Extend coverage beyond `Подготовка документов` into the remaining lifecycle transitions for a completed payment deal.

Out of scope:

- downstream treasury execution
- real quote acceptance against external pricing
- formal-document generation correctness
- OCR/attachment ingestion side effects beyond successful upload

Owning modules:

- `apps/crm`
- `@bedrock/deals`
- `@bedrock/agreements`
- `@bedrock/parties`
- `@bedrock/calculations`
- `@bedrock/files`
- `@bedrock/treasury`
