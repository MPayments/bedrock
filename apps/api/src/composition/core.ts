import type { AccountingModule } from "@bedrock/accounting";
import {
  createCustomerMembershipsService,
  createIamService,
  createPortalAccessGrantsService,
  type CustomerMembershipsService,
  type IamService,
  type PortalAccessGrantsService,
} from "@bedrock/iam";
import {
  createBetterAuthPasswordHasher,
} from "@bedrock/iam/adapters/better-auth";
import {
  DrizzleCustomerMembershipReads,
  DrizzleCustomerMembershipsUnitOfWork,
  DrizzleIamUsersReads,
  DrizzleIamUsersUnitOfWork,
  DrizzlePortalAccessGrantReads,
  DrizzlePortalAccessGrantsUnitOfWork,
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
  portalAccessGrantsService: PortalAccessGrantsService;
}

export function createCoreServices(): ApiCoreServices {
  const logger = createConsoleLogger({ app: "bedrock-api" });
  const idempotency = createIdempotencyService({ logger });
  const iamReads = new DrizzleIamUsersReads(db);
  const iamCommandUow = new DrizzleIamUsersUnitOfWork({
    persistence: createPersistenceContext(db),
  });
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
    reads: iamReads,
    commandUow: iamCommandUow,
    passwordHasher,
    logger,
  });
  const customerMembershipsService = createCustomerMembershipsService({
    commandUow: new DrizzleCustomerMembershipsUnitOfWork({
      persistence: createPersistenceContext(db),
    }),
    reads: new DrizzleCustomerMembershipReads(db),
  });
  const portalAccessGrantsService = createPortalAccessGrantsService({
    commandUow: new DrizzlePortalAccessGrantsUnitOfWork({
      persistence: createPersistenceContext(db),
    }),
    reads: new DrizzlePortalAccessGrantReads(db),
  });

  return {
    logger,
    accountingModule,
    idempotency,
    ledgerModule,
    iamService,
    customerMembershipsService,
    portalAccessGrantsService,
  };
}
