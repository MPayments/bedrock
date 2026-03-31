import { randomUUID } from "node:crypto";

import {
  createAgreementsModule,
  type AgreementsModule,
  type AgreementsModuleDeps,
} from "@bedrock/agreements";
import {
  DrizzleAgreementReads,
  DrizzleAgreementsUnitOfWork,
} from "@bedrock/agreements/adapters/drizzle";
import type { CurrenciesService } from "@bedrock/currencies";
import {
  DrizzleCustomerReads,
  DrizzleOrganizationReads,
  DrizzleRequisiteBindingReads,
  DrizzleRequisiteReads,
} from "@bedrock/parties/adapters/drizzle";
import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createPersistenceContext,
  type Database,
  type PersistenceContext,
} from "@bedrock/platform/persistence";

export function createApiAgreementsModule(input: {
  db: Database;
  logger: Logger;
  idempotency: IdempotencyPort;
  currencies: Pick<CurrenciesService, "findById">;
  now?: AgreementsModuleDeps["now"];
  generateUuid?: AgreementsModuleDeps["generateUuid"];
  persistence?: PersistenceContext;
}): AgreementsModule {
  const customerReads = new DrizzleCustomerReads(input.db);
  const organizationReads = new DrizzleOrganizationReads(input.db);
  const requisiteReads = new DrizzleRequisiteReads(input.db);
  const requisiteBindingReads = new DrizzleRequisiteBindingReads(input.db);
  const persistence = input.persistence ?? createPersistenceContext(input.db);

  return createAgreementsModule({
    logger: input.logger,
    now: input.now ?? (() => new Date()),
    generateUuid: input.generateUuid ?? randomUUID,
    idempotency: input.idempotency,
    reads: new DrizzleAgreementReads(input.db),
    references: {
      async findCustomerById(id: string) {
        return customerReads.findById(id);
      },
      async findOrganizationById(id: string) {
        return organizationReads.findById(id);
      },
      async findRequisiteSubjectById(requisiteId: string) {
        const subject = await requisiteReads.findSubjectById(requisiteId);
        if (!subject) {
          return null;
        }

        return {
          id: subject.ownerId,
          organizationId: subject.organizationId,
          ownerType: subject.ownerType,
        };
      },
      async findOrganizationRequisiteBindingByRequisiteId(requisiteId: string) {
        return requisiteBindingReads.findByRequisiteId(requisiteId);
      },
      async assertCurrencyExists(id: string) {
        await input.currencies.findById(id);
      },
    },
    commandUow: new DrizzleAgreementsUnitOfWork({ persistence }),
  });
}
