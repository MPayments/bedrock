# Integration Tests

Integration tests for the ledger package that use real PostgreSQL and TigerBeetle instances.

## Prerequisites

1. **Docker and Docker Compose** must be installed
2. **Services must be running**: PostgreSQL and TigerBeetle
3. **Database migrations applied**: Run `db:push` to create tables

## Starting Services

From the project root:

```bash
# Start services
cd infra
docker-compose up -d

# Verify services are running
docker-compose ps

# View logs
docker-compose logs -f
```

## Database Setup

Before running integration tests, ensure database migrations are applied:

```bash
# From packages/db
npm run db:generate  # Generate migration files (if schema changed)
npm run db:push      # Apply migrations to database
```

## Environment Variables

The integration tests use the following environment variables (from `.env` in project root):

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=postgres
TB_ADDRESS=localhost:3000
```

## Running Integration Tests

From `packages/ledger`:

```bash
# Run all integration tests
npm run test:integration

# Watch mode
npm run test:integration:watch

# Run both unit and integration tests
npm run test:all
```

## Test Structure

- **setup.ts** - Database and TigerBeetle connection setup, cleanup between tests
- **helpers.ts** - Utility functions for integration tests
- **engine.test.ts** - End-to-end entry creation tests (11 tests)
- **worker.test.ts** - Posting to TigerBeetle tests (8 tests)
- **resolve.test.ts** - Account creation in both DB and TB tests (12 tests)

## What Integration Tests Cover

### Engine Tests (11 tests)
- Full entry creation flow with database persistence
- Idempotency with real database conflicts
- Multi-transfer entries
- Pending transfers
- Linked transfers (chains)
- Post/void pending transfers
- Outbox creation
- Mixed transfer types
- Large amounts

### Worker Tests (8 tests)
- Actual posting to TigerBeetle
- Account creation in TigerBeetle
- Balance verification
- Multiple transfers
- Pending transfers with timeouts
- Linked transfers (atomic batches)
- Account reuse across transfers
- Multiple currencies
- Batch processing

### Resolve Tests (12 tests)
- Account creation in both PostgreSQL and TigerBeetle
- Deterministic ID generation
- Concurrent account creation (race conditions)
- Account reuse and idempotency
- Multiple currencies
- Complex account keys
- Account code assignment
- Balance verification

## Test Isolation

Each test:
- Uses random UUIDs for org IDs to avoid conflicts
- Runs in isolated transactions where possible
- Cleans up data after completion via `TRUNCATE` in `afterEach`

## Troubleshooting

### Services not running

```bash
cd infra
docker-compose up -d
```

### Database schema not created

```bash
cd packages/db
npm run db:push
```

### TigerBeetle data file not initialized

```bash
cd infra
docker-compose down
rm -rf data/0_0.tigerbeetle
docker run --rm -v $(pwd)/data:/data ghcr.io/tigerbeetle/tigerbeetle format --cluster=0 --replica=0 /data/0_0.tigerbeetle
docker-compose up -d
```

### Database connection errors

Check that PostgreSQL is accessible:

```bash
docker exec -it infra-postgres-1 psql -U postgres -c "SELECT version();"
```

### TigerBeetle connection errors

Check that TigerBeetle is accessible:

```bash
docker exec -it infra-tigerbeetle-1 ps aux
```

## Cleanup

After testing, you can stop the services:

```bash
cd infra
docker-compose down

# To also remove data volumes
docker-compose down -v
```

## Performance

Integration tests are slower than unit tests since they:
- Create real database tables
- Execute SQL queries
- Create accounts in TigerBeetle
- Post transfers to TigerBeetle

Typical run time: 3-4 seconds for all 31 integration tests.

## Test Coverage Summary

- **Total**: 31 integration tests
- **Engine**: 11 tests covering entry creation flows
- **Worker**: 8 tests covering TigerBeetle posting
- **Resolve**: 12 tests covering account resolution

Combined with 170 unit tests (5 skipped), the ledger package has comprehensive test coverage.
