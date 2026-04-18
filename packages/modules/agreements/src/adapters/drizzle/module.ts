import { randomUUID } from "node:crypto";

import {
  DrizzleCustomerReads,
  DrizzleOrganizationReads,
  DrizzleRequisiteBindingReads,
  DrizzleRequisiteReads,
} from "@bedrock/parties/adapters/drizzle";
import type { CurrenciesService } from "@bedrock/currencies";
import { createCurrenciesQueries } from "@bedrock/currencies/queries";
import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createPersistenceContext,
  type Database,
  type PersistenceContext,
  type Transaction,
} from "@bedrock/platform/persistence";

import {
  createAgreementsModule,
  type AgreementsModule,
  type AgreementsModuleDeps,
} from "../../module";
import { DrizzleAgreementReads } from "./agreement.reads";
import { DrizzleAgreementsUnitOfWork } from "./agreements.uow";

export interface CreateAgreementsModuleFromDrizzleInput {
  currencies: Pick<CurrenciesService, "findById">;
  db: Database | Transaction;
  generateUuid?: AgreementsModuleDeps["generateUuid"];
  idempotency: IdempotencyPort;
  logger: Logger;
  now?: AgreementsModuleDeps["now"];
  persistence?: PersistenceContext;
}

export function createAgreementsModuleFromDrizzle(
  input: CreateAgreementsModuleFromDrizzleInput,
): AgreementsModule {
  const customerReads = new DrizzleCustomerReads(input.db);
  const organizationReads = new DrizzleOrganizationReads(input.db);
  const requisiteReads = new DrizzleRequisiteReads(input.db);
  const requisiteBindingReads = new DrizzleRequisiteBindingReads(input.db);
  const persistence =
    input.persistence ?? createPersistenceContext(input.db as Database);
  const currenciesQueries = createCurrenciesQueries({ db: input.db });

  return createAgreementsModule({
    commandUow: new DrizzleAgreementsUnitOfWork({ persistence }),
    generateUuid: input.generateUuid ?? randomUUID,
    idempotency: input.idempotency,
    logger: input.logger,
    now: input.now ?? (() => new Date()),
    reads: new DrizzleAgreementReads(input.db, currenciesQueries),
    references: {
      assertCurrencyExists: async (id: string) => {
        await input.currencies.findById(id);
      },
      findCustomerById: customerReads.findById.bind(customerReads),
      async findOrganizationRequisiteBindingByRequisiteId(requisiteId: string) {
        return requisiteBindingReads.findByRequisiteId(requisiteId);
      },
      findOrganizationById: organizationReads.findById.bind(organizationReads),
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
    },
  });
}
