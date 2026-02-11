# @bedrock/kernel

Shared cross-package primitives for the monorepo.

## Exports

- Errors:
  - `AppError`
- Logging:
  - `createConsoleLogger`
  - `noopLogger`
  - `Logger` type
- Canonicalization:
  - `stableStringify`
  - `makePlanKey`
- Currency:
  - `normalizeCurrency`
  - `isValidCurrency`
  - `parseCurrency`
  - `Currency` type
- Crypto:
  - `sha256Hex`
- Constants:
  - `TransferCodes` (`@bedrock/kernel/constants`)

## Why this package exists

- Keeps utility contracts stable across `ledger`, `treasury`, `fx`, and `transfers`.
- Centralizes deterministic key generation helpers used for idempotency and hashing.
- Prevents duplicated transfer code maps in domain packages.

## Scripts

- `npm run build`
- `npm run dev`
- `npm run check-types`

