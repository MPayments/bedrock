import type { AccountingModule } from "@bedrock/accounting";
import { createAccountingModuleFromDrizzle } from "@bedrock/accounting/adapters/drizzle";
import { createDrizzleDocumentsReadModel } from "@bedrock/documents/read-model";
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
import { createLedgerModuleFromDrizzle } from "@bedrock/ledger/adapters/drizzle";
import { createPartiesQueries } from "@bedrock/parties/queries";
import {
  createIdempotencyService,
  type IdempotencyService,
} from "@bedrock/platform/idempotency-postgres";
import {
  createConsoleLogger,
  type Logger,
} from "@bedrock/platform/observability/logger";
import {
  createPersistenceContext,
  type PersistenceContext,
} from "@bedrock/platform/persistence";
import { db } from "../db/client";

export interface ApiCoreServices {
  logger: Logger;
  persistence: PersistenceContext;
  accountingModule: AccountingModule;
  idempotency: IdempotencyService;
  ledgerModule: LedgerModule;
  iamService: IamService;
  customerMembershipsService: CustomerMembershipsService;
  portalAccessGrantsService: PortalAccessGrantsService;
}

export function createCoreServices(): ApiCoreServices {
  const logger = createConsoleLogger({ app: "bedrock-api" });
  const idempotency = createIdempotencyService({ logger });
  const persistence = createPersistenceContext(db);
  const iamReads = new DrizzleIamUsersReads(db);
  const iamCommandUow = new DrizzleIamUsersUnitOfWork({
    persistence,
  });
  const passwordHasher = createBetterAuthPasswordHasher();
  const partiesQueries = createPartiesQueries({ db });
  const ledgerModule = createLedgerModuleFromDrizzle({
    assertInternalLedgerBooks:
      ({ bookIds }) =>
        partiesQueries.organizations.assertBooksBelongToInternalLedgerOrganizations(
          bookIds,
        ),
    db,
    idempotency,
    logger,
  });
  const accountingModule = createAccountingModuleFromDrizzle({
    db,
    documentsReadModel: createDrizzleDocumentsReadModel({ db }),
    logger,
    persistence,
  });
  const iamService = createIamService({
    reads: iamReads,
    commandUow: iamCommandUow,
    passwordHasher,
    logger,
  });
  const customerMembershipsService = createCustomerMembershipsService({
    commandUow: new DrizzleCustomerMembershipsUnitOfWork({
      persistence,
    }),
    reads: new DrizzleCustomerMembershipReads(db),
  });
  const portalAccessGrantsService = createPortalAccessGrantsService({
    commandUow: new DrizzlePortalAccessGrantsUnitOfWork({
      persistence,
    }),
    reads: new DrizzlePortalAccessGrantReads(db),
  });

  return {
    logger,
    persistence,
    accountingModule,
    idempotency,
    ledgerModule,
    iamService,
    customerMembershipsService,
    portalAccessGrantsService,
  };
}
