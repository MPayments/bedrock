# Bedrock Usage Guide

## Summary

Use this guide when adding a new Bedrock primitive or a new Multihansa product package after the rename split.

## Choose the Right Layer

Put code in `packages/bedrock/*` when it is portable and product-agnostic:

- runtime primitives
- definition APIs
- ports and adapters
- generic schema owned by the framework

Put code in `packages/domains/*` when it is Multihansa-specific:

- business services
- product document definitions
- reporting logic
- the `@multihansa/app` bundle

Put code in:

- `packages/sdk/*` for `@multihansa/ui` and `@multihansa/api-client`
- `packages/tooling/*` for ESLint, TS config, and test utils
- `packages/db` only for schema aggregation, migrations, DB client, and seeds

## Add a Bedrock Package

1. Create `packages/bedrock/<name>/package.json` with the `@bedrock/<name>` scope.
2. Keep runtime code under `src/**`.
3. Keep tests under `tests/**`.
4. Export only the public surface from `src/index.ts`.
5. Do not import `@multihansa/*` runtime packages.

Representative files:

- [`packages/bedrock/modules/src/app.ts`](/Users/alexey.eramasov/dev/ledger/packages/bedrock/modules/src/app.ts)
- [`packages/bedrock/documents/src/index.ts`](/Users/alexey.eramasov/dev/ledger/packages/bedrock/documents/src/index.ts)

## Add a Multihansa Package

1. Create `packages/domains/<name>/package.json` with the `@multihansa/<name>` scope.
2. Import Bedrock primitives as needed.
3. Keep product schema in the package itself.
4. Register the package in the Multihansa bundle if it contributes modules/services.

Representative files:

- [`packages/domains/payments/src/index.ts`](/Users/alexey.eramasov/dev/ledger/packages/domains/payments/src/index.ts)
- [`packages/domains/multihansa-app/src/bundle.ts`](/Users/alexey.eramasov/dev/ledger/packages/domains/multihansa-app/src/bundle.ts)

## Register Schema

After adding schema to a Bedrock or Multihansa package:

1. Export it from the owning package
2. Aggregate it in [`packages/db/src/schema/index.ts`](/Users/alexey.eramasov/dev/ledger/packages/db/src/schema/index.ts)
3. Run the baseline flow:

```bash
bun run --filter=@multihansa/db db:nuke
bun run --filter=@multihansa/db db:migrate
bun run --filter=@multihansa/db db:seed
```

## Run and Verify

Development:

```bash
bun run --filter=multihansa-api dev
bun run --filter=multihansa-web dev
bun run --filter=multihansa-workers dev
```

Verification:

```bash
bun run check-types
bun run lint
bun run test
bun run test:integration
bun run build --filter=multihansa-api
bun run --filter=multihansa-workers build
```

## Common Mistakes

- importing `@multihansa/db/client` from `packages/bedrock/*` or `packages/domains/*`
- putting product schema directly in `@multihansa/db`
- importing product runtime packages from `packages/bedrock/*`
- keeping product packages under the `@bedrock/*` scope
