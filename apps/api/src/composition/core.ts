import {
  createAccountingService,
  type AccountingService,
} from "@bedrock/accounting";
import { rawPackDefinition } from "@bedrock/accounting/packs/bedrock-core-default";
import {
  createBalancesService,
  type BalancesService,
} from "@bedrock/balances";
import {
  createDrizzleAuthIdentityStore,
} from "@bedrock/identity";
import { createBetterAuthPasswordHasher } from "@bedrock/adapter-auth-betterauth";
import { createIdempotencyService, type IdempotencyPort } from "@bedrock/adapter-idempotency-postgres";
import {
  createLedgerEngine,
  createLedgerReadService,
  type LedgerEngine,
  type LedgerReadService,
} from "@bedrock/ledger";
import { assertBooksBelongToInternalLedgerCounterparties } from "@bedrock/counterparties";
import {
  createUsersService,
  type UsersService,
} from "@bedrock/users";
import { createConsoleLogger, type Logger } from "@bedrock/observability/logger";
import { db } from "@bedrock/adapter-db-drizzle/client";

export interface ApiCoreServices {
  logger: Logger;
  accountingService: AccountingService;
  balancesService: BalancesService;
  idempotency: IdempotencyPort;
  ledger: LedgerEngine;
  ledgerReadService: LedgerReadService;
  usersService: UsersService;
}

export function createCoreServices(): ApiCoreServices {
  const logger = createConsoleLogger({ app: "bedrock-api" });
  const idempotency = createIdempotencyService({ logger });
  const authStore = createDrizzleAuthIdentityStore({ db });
  const passwordHasher = createBetterAuthPasswordHasher();
  const accountingService = createAccountingService({
    db,
    logger,
    defaultPackDefinition: rawPackDefinition,
  });
  const ledger = createLedgerEngine({
    db,
    assertInternalLedgerBooks: assertBooksBelongToInternalLedgerCounterparties,
  });
  const ledgerReadService = createLedgerReadService({ db });
  const balancesService = createBalancesService({ db, idempotency, logger });
  const usersService = createUsersService({
    authStore,
    passwordHasher,
    logger,
  });

  return {
    logger,
    accountingService,
    balancesService,
    idempotency,
    ledger,
    ledgerReadService,
    usersService,
  };
}
