import type { AccountingModule } from "@bedrock/accounting";
import {
  createCustomerMembershipsService,
  createIamService,
  type CustomerMembershipsService,
  type IamService,
} from "@bedrock/iam";
import {
  createBetterAuthPasswordHasher,
} from "@bedrock/iam/adapters/better-auth";
import {
  createDrizzleIamIdentityStore,
  DrizzleCustomerMembershipReads,
  DrizzleCustomerMembershipsUnitOfWork,
} from "@bedrock/iam/adapters/drizzle";
import type { LedgerModule } from "@bedrock/ledger";
import {
  createIdempotencyService,
  type IdempotencyPort,
} from "@bedrock/platform/idempotency-postgres";
import {
  createConsoleLogger,
  type Logger,
} from "@bedrock/platform/observability/logger";
import { createPersistenceContext } from "@bedrock/platform/persistence";

import { createApiAccountingModule } from "./accounting-module";
import { createApiLedgerModule } from "./ledger-module";
import { db } from "../db/client";

export interface ApiCoreServices {
  logger: Logger;
  accountingModule: AccountingModule;
  idempotency: IdempotencyPort;
  ledgerModule: LedgerModule;
  iamService: IamService;
  customerMembershipsService: CustomerMembershipsService;
}

export function createCoreServices(): ApiCoreServices {
  const logger = createConsoleLogger({ app: "bedrock-api" });
  const idempotency = createIdempotencyService({ logger });
  const authStore = createDrizzleIamIdentityStore({ db });
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
  const iamService = createIamService({
    identityStore: authStore,
    passwordHasher,
    logger,
  });
  const customerMembershipsService = createCustomerMembershipsService({
    commandUow: new DrizzleCustomerMembershipsUnitOfWork({
      persistence: createPersistenceContext(db),
    }),
    reads: new DrizzleCustomerMembershipReads(db),
  });

  return {
    logger,
    accountingModule,
    idempotency,
    ledgerModule,
    iamService,
    customerMembershipsService,
  };
}
