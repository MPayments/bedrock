# @multihansa/test-utils

Shared testing utilities used across package unit/integration tests.

## What it provides

- Test fixtures:
  - deterministic UUIDs
  - deterministic dates
  - default currencies
- DB mocking helpers:
  - Drizzle mock DB
  - stub DB/transaction builders
  - helper functions for `select/insert/update/execute` chains

## Main exports

- Database mocks:
  - `createMockDb`
  - `createStubDb`
  - `createStubTx`
  - `mockSelectReturns`
  - `mockInsertReturns`
  - `mockUpdateReturns`
  - `mockExecuteReturns`
  - `mockTransactionWith`
- Fixtures:
  - `TEST_UUIDS`
  - `TEST_DATES`
  - `TEST_CURRENCIES`
  - `testUuid`
  - `createTestId`

## Scripts

- `npm run check-types`
- `npm run test` (placeholder)

