---
name: deal-smoke
description: Run the Bedrock CRM operator flow for payment deal, collect blockers and bugs, and write a structured bug report with artifacts. Use for local UI smoke tests in apps/crm.
---

# Deal smoke test

## Goal
Act as an internal operator in Bedrock CRM and try to complete the payment deal path end-to-end.

Business scenario:
- customer: White Pride
- source currency: AED
- payout currency: USD
- beneficiary: Almutlag
- deal type: payment
- desired result: at minimum create/save the draft deal; if available continue through quote/calculation/documents

## Mandatory rules
- Do not modify production code during the first exploratory pass.
- You may create or update only:
  - docs/bugs/**
  - artifacts/deal-payment/**
  - tests/e2e/** (only if explicitly asked in the prompt)
- If the flow is blocked by missing seed data, missing auth, or environment setup, record that as a bug.
- For each issue capture:
  - current URL
  - exact UI label/button text
  - screenshot path
  - console/network error if visible
  - expected behavior
  - actual behavior
  - severity: blocker | major | minor
  - suspected layer: crm-ui | api | iam | deals | calculations | files | treasury | test-data | unknown

## Workflow
1. Verify local services are reachable.
2. Open CRM.
3. Log in with the provided test account.
4. Navigate to the deal creation flow.
5. Try to create payment deal as an operator.
6. On every blocker, investigate just enough to identify likely root cause.
7. Write:
   - docs/bugs/deal-payment-run.md
   - one file per bug under docs/bugs/deal-payment/
8. Save screenshots and related artifacts under artifacts/deal-payment/
9. End with a concise summary of:
   - path reached
   - blockers
   - likely highest-value fixes