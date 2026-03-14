import {
  createAccountingService,
  createDrizzleAccountingChartRepository,
  type AccountingService,
} from "@bedrock/accounting";
import {
  createAccountingPacksService,
  createDrizzleAccountingPacksRepository,
  createInMemoryAccountingCompiledPackCache,
} from "@bedrock/accounting/packs";
import { rawPackDefinition } from "@bedrock/accounting/packs/bedrock-core-default";
import {
  createBalancesService,
  type BalancesService,
} from "@bedrock/balances";
import {
  createLedgerService,
  createLedgerReadService,
  type LedgerService,
  type LedgerReadService,
} from "@bedrock/ledger";
import { assertBooksBelongToInternalLedgerOrganizations } from "@bedrock/organizations";
import { createBetterAuthPasswordHasher } from "@bedrock/platform/auth-betterauth";
import {
  createDrizzleAuthIdentityStore,
} from "@bedrock/platform/auth-model/infra/drizzle";
import { createIdempotencyService, type IdempotencyPort } from "@bedrock/platform/idempotency-postgres";
import { createConsoleLogger, type Logger } from "@bedrock/platform/observability/logger";
import {
  createUsersService,
  type UsersService,
} from "@bedrock/users";

import { db } from "../db/client";

export interface ApiCoreServices {
  logger: Logger;
  accountingService: AccountingService;
  balancesService: BalancesService;
  idempotency: IdempotencyPort;
  ledger: LedgerService;
  ledgerReadService: LedgerReadService;
  usersService: UsersService;
}

function createApiAccountingService(): AccountingService {
  const packsRepository = createDrizzleAccountingPacksRepository(db);
  const packsService = createAccountingPacksService({
    defaultPackDefinition: rawPackDefinition,
    cache: createInMemoryAccountingCompiledPackCache(),
    repository: packsRepository,
    withTransaction: async (run) =>
      db.transaction(async (tx) =>
        run(createDrizzleAccountingPacksRepository(tx)),
      ),
    assertBooksBelongToInternalLedgerOrganizations: (bookIds) =>
      assertBooksBelongToInternalLedgerOrganizations({ db, bookIds }),
  });

  return createAccountingService({
    repository: createDrizzleAccountingChartRepository(db),
    packsService,
  });
}

export function createCoreServices(): ApiCoreServices {
  const logger = createConsoleLogger({ app: "bedrock-api" });
  const idempotency = createIdempotencyService({ logger });
  const authStore = createDrizzleAuthIdentityStore({ db });
  const passwordHasher = createBetterAuthPasswordHasher();
  const accountingService = createApiAccountingService();
  const ledger = createLedgerService({
    db,
    assertInternalLedgerBooks: assertBooksBelongToInternalLedgerOrganizations,
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
