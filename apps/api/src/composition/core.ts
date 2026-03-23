import type { AccountingModule } from "@bedrock/accounting";
import type { LedgerModule } from "@bedrock/ledger";
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
import { createApiLedgerModule } from "./ledger-module";
import { db } from "../db/client";

export interface ApiCoreServices {
  logger: Logger;
  accountingModule: AccountingModule;
  idempotency: IdempotencyPort;
  ledgerModule: LedgerModule;
  usersService: UsersService;
}

export function createCoreServices(): ApiCoreServices {
  const logger = createConsoleLogger({ app: "bedrock-api" });
  const idempotency = createIdempotencyService({ logger });
  const authStore = createDrizzleAuthIdentityStore({ db });
  const passwordHasher = createBetterAuthPasswordHasher();
  const ledgerModule = createApiLedgerModule({
    db,
    idempotency,
    logger,
  });
  const accountingModule = createApiAccountingModule({
    db,
    persistence: createPersistenceContext(db),
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
    idempotency,
    ledgerModule,
    usersService,
  };
}
