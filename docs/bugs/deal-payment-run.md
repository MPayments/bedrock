# Payment deal run

Date: 2026-04-13 11:42-11:49 MSK
Environment: local Codex Desktop thread, CRM `http://localhost:3002`, API `http://localhost:3000`, Portal `http://localhost:3003`
Operator account: `operator@bedrock.com`
Path reached: login -> new payment deal -> saved draft -> pricing tab -> documents tab -> `invoice.pdf` uploaded
Run status: passed

## Summary

The payment deal CRM path completed successfully after the local database was reset and seeded. The run created a `payment` deal for `White Pride`, reached the saved draft workspace, confirmed the pricing tab was reachable, and uploaded `tests/e2e/fixtures/invoice.pdf` on the documents tab.

The only substantive issue found in this pass was outside the CRM flow itself: `bun run infra:up` recreated Postgres without the DB env vars, which caused the first `bun run deal-payment:reset-db` attempt to fail until Postgres was recreated with `.env` exported into the shell.

## Steps completed

1. Logged into CRM as the seeded operator account.
2. Created a new deal for customer `White Pride` and applicant `WHITE PRIDE LLC`.
3. Selected agreement `WP-AFA-2026-001` and deal type `payment`.
4. Filled the payment intake with AED source currency, USD payout currency, invoice data, and beneficiary bank details.
5. Saved the draft and reached `/deals/0e0bf059-3c1a-475f-af0e-69d1156ede0e`.
6. Opened the pricing tab and confirmed the quote action was visible.
7. Opened the documents tab and uploaded `invoice.pdf`.

## Bugs found

- [BUG-001 — `infra:up` starts Postgres without DB env and breaks reset](/Users/alexey.eramasov/dev/ledger/docs/bugs/deal-payment/BUG-001-infra-up-missing-postgres-env.md)
- No CRM UI regression was observed on the payment deal happy path in this pass.

## Highest-value fixes

- Update `infra:up` to pass `.env` explicitly into Docker Compose and wait for Postgres readiness before chaining reset/seed steps.
- Keep Playwright automation on stable test IDs or value-based selectors for localized controls like currencies and countries.

## Next steps

1. Keep the exploratory note for the original CRM-only smoke pass, but use `tests/e2e/deal-payment.spec.ts` as the current source of truth for the full CRM-to-finance regression.
2. Add operator-facing reconciliation coverage once finance exposes a supported UI or API path instead of relying on the test-side fixture.
3. Recheck `Документы` after OCR finishes and confirm whether internal document generation becomes available.
