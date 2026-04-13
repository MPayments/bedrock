---
name: deal-payment-playwright-cli
description: Run the local Bedrock CRM payment deal flow via playwright-cli, capture evidence, and write bug reports. Use this instead of browser MCP for local UI smoke tests.
---

# Payment Deal Playwright CLI

Use `PLAYWRIGHT_CLI_SESSION=deal-payment` for all browser commands.

Assume:

- CRM: `http://localhost:3002`
- API: `http://localhost:3000`
- Portal: `http://localhost:3003`
- operator account: `operator@bedrock.com` / `operator123`

Rules:

- First pass is exploratory only. Do not fix production code during the same run.
- Save artifacts under `artifacts/deal-payment/<timestamp>/`.
- Write `docs/bugs/deal-payment-run.md` and one file per bug under `docs/bugs/deal-payment/`.
- After each major step, save:
  - snapshot yaml
  - screenshot png
- On any failure, also save:
  - console output
  - network output
  - current URL
  - visible error text
- Classify each issue as:
  - blocker | major | minor
- Classify likely layer as:
  - crm-ui | iam | parties | agreements | deals | calculations | files | treasury | api | unknown

Recommended local actions:

- `bun run infra:up`
- `bun run deal-payment:reset-db`
- `bun run deal-payment:start-stack`
- `bun run deal-payment:explore`

Exploratory flow:

1. Open CRM with Playwright CLI.
2. Log in with the seeded operator account.
3. Create payment deal as a `payment` deal.
4. Customer: `White Pride`.
5. Acting legal entity: `WHITE PRIDE LLC`.
6. Agreement: `WP-AFA-2026-001`.
7. Set source currency to `AED`.
8. Set payout currency to `USD`.
9. Beneficiary: `Almutlag`.
10. Fill the required payment, invoice, and bank fields.
11. Stop once draft creation succeeds, then continue into quote, calculation, or documents only if the UI allows it.
12. End with a concise summary of the path reached, blockers, and the highest-value fixes.

Useful commands:

```bash
PLAYWRIGHT_CLI_SESSION=deal-payment bun x playwright-cli open http://localhost:3002/login --headed --persistent
PLAYWRIGHT_CLI_SESSION=deal-payment bun x playwright-cli tracing-start
PLAYWRIGHT_CLI_SESSION=deal-payment bun x playwright-cli snapshot --filename=artifacts/deal-payment/<timestamp>/01-login.yaml
PLAYWRIGHT_CLI_SESSION=deal-payment bun x playwright-cli screenshot --filename=artifacts/deal-payment/<timestamp>/01-login.png
PLAYWRIGHT_CLI_SESSION=deal-payment bun x playwright-cli console warning > artifacts/deal-payment/<timestamp>/01-console.txt
PLAYWRIGHT_CLI_SESSION=deal-payment bun x playwright-cli network > artifacts/deal-payment/<timestamp>/01-network.txt
```
