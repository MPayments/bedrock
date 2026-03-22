import type { AccountingModule } from "@bedrock/accounting";
import { createBalancesService, type BalancesService } from "@bedrock/balances";
import {
  createLedgerService,
  createLedgerReadService,
  type LedgerService,
  type LedgerReadService,
} from "@bedrock/ledger";
import { createBetterAuthPasswordHasher } from "@bedrock/platform/auth-betterauth";
import { createDrizzleAuthIdentityStore } from "@bedrock/platform/auth-model/infra/drizzle";
import {
  createIdempotencyService,
  type IdempotencyPort,
} from "@bedrock/platform/idempotency-postgres";
import {
  createConsoleLogger,
  type Logger,
} from "@bedrock/platform/observability/logger";
import { createPersistenceContext } from "@bedrock/platform/persistence";
import { createUsersService, type UsersService } from "@bedrock/users";

import { createApiAccountingModule } from "./accounting-module";
import { createApiPartiesReadRuntime } from "./parties-module";
import { db } from "../db/client";

export interface ApiCoreServices {
  logger: Logger;
  accountingModule: AccountingModule;
  balancesService: BalancesService;
  idempotency: IdempotencyPort;
  ledger: LedgerService;
  ledgerReadService: LedgerReadService;
  usersService: UsersService;
}

export function createCoreServices(): ApiCoreServices {
  const logger = createConsoleLogger({ app: "bedrock-api" });
  const idempotency = createIdempotencyService({ logger });
  const authStore = createDrizzleAuthIdentityStore({ db });
  const passwordHasher = createBetterAuthPasswordHasher();
  const { organizationsQueries } = createApiPartiesReadRuntime(db);
  const ledger = createLedgerService({
    db,
    assertInternalLedgerBooks: async ({ bookIds }) =>
      organizationsQueries.assertBooksBelongToInternalLedgerOrganizations(
        bookIds,
      ),
  });
  const ledgerReadService = createLedgerReadService({ db });
  const accountingModule = createApiAccountingModule({
    db,
    persistence: createPersistenceContext(db),
    logger,
    ledgerReadPort: ledgerReadService,
  });
  const balancesService = createBalancesService({
    persistence: createPersistenceContext(db),
    idempotency,
    logger,
  });
  const usersService = createUsersService({
    identityStore: authStore,
    passwordHasher,
    logger,
  });

  return {
    logger,
    accountingModule,
    balancesService,
    idempotency,
    ledger,
    ledgerReadService,
    usersService,
  };
}
