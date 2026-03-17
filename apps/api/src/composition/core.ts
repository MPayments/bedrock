import {
  createAccountingService,
  createAccountingChartService,
  createAccountingPacksService,
  createInMemoryAccountingCompiledPackCache,
  type AccountingService,
} from "@bedrock/accounting";
import { rawPackDefinition } from "@bedrock/accounting/packs/bedrock-core-default";
import { createBalancesService, type BalancesService } from "@bedrock/balances";
import {
  createLedgerService,
  createLedgerReadService,
  type LedgerService,
  type LedgerReadService,
} from "@bedrock/ledger";
import { createOrganizationsQueries } from "@bedrock/organizations/queries";
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
  const organizationsQueries = createOrganizationsQueries({ db });
  const packsService = createAccountingPacksService({
    db,
    defaultPackDefinition: rawPackDefinition,
    cache: createInMemoryAccountingCompiledPackCache(),
    assertBooksBelongToInternalLedgerOrganizations:
      organizationsQueries.assertBooksBelongToInternalLedgerOrganizations,
  });

  return createAccountingService({
    chart: createAccountingChartService({ db }),
    packs: packsService,
  });
}

export function createCoreServices(): ApiCoreServices {
  const logger = createConsoleLogger({ app: "bedrock-api" });
  const idempotency = createIdempotencyService({ logger });
  const authStore = createDrizzleAuthIdentityStore({ db });
  const passwordHasher = createBetterAuthPasswordHasher();
  const accountingService = createApiAccountingService();
  const organizationsQueries = createOrganizationsQueries({ db });
  const ledger = createLedgerService({
    db,
    assertInternalLedgerBooks: async ({ bookIds }) =>
      organizationsQueries.assertBooksBelongToInternalLedgerOrganizations(
        bookIds,
      ),
  });
  const ledgerReadService = createLedgerReadService({ db });
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
    accountingService,
    balancesService,
    idempotency,
    ledger,
    ledgerReadService,
    usersService,
  };
}
