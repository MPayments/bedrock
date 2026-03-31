import { randomUUID } from "node:crypto";

import { DrizzleAgreementReads } from "@bedrock/agreements/adapters/drizzle";
import { DrizzleCalculationReads } from "@bedrock/calculations/adapters/drizzle";
import type { CurrenciesService } from "@bedrock/currencies";
import { createCurrenciesQueries } from "@bedrock/currencies/queries";
import {
  createDealsModule,
  DealTypeNotSupportedError,
  type DealsModule,
  type DealsModuleDeps,
} from "@bedrock/deals";
import {
  DrizzleDealReads,
  DrizzleDealsUnitOfWork,
} from "@bedrock/deals/adapters/drizzle";
import { DrizzleCounterpartyReads, DrizzleCustomerReads } from "@bedrock/parties/adapters/drizzle";
import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createPersistenceContext,
  type Database,
  type PersistenceContext,
} from "@bedrock/platform/persistence";

export function createApiDealsModule(input: {
  currencies: Pick<CurrenciesService, "findById">;
  db: Database;
  generateUuid?: DealsModuleDeps["generateUuid"];
  idempotency: IdempotencyPort;
  logger: Logger;
  now?: DealsModuleDeps["now"];
  persistence?: PersistenceContext;
}): DealsModule {
  const customerReads = new DrizzleCustomerReads(input.db);
  const counterpartyReads = new DrizzleCounterpartyReads(input.db);
  const calculationReads = new DrizzleCalculationReads(input.db);
  const persistence = input.persistence ?? createPersistenceContext(input.db);
  const currenciesQueries = createCurrenciesQueries({ db: input.db });
  const agreementReadsWithCurrencies = new DrizzleAgreementReads(
    input.db,
    currenciesQueries,
  );

  return createDealsModule({
    logger: input.logger,
    now: input.now ?? (() => new Date()),
    generateUuid: input.generateUuid ?? randomUUID,
    idempotency: input.idempotency,
    reads: new DrizzleDealReads(input.db, currenciesQueries),
    references: {
      async findAgreementById(id: string) {
        const agreement = await agreementReadsWithCurrencies.findById(id);
        if (!agreement) {
          return null;
        }

        return {
          id: agreement.id,
          customerId: agreement.customerId,
          organizationId: agreement.organizationId,
          isActive: agreement.isActive,
        };
      },
      async findCalculationById(id: string) {
        const calculation = await calculationReads.findById(id);
        if (!calculation) {
          return null;
        }

        return {
          id: calculation.id,
          isActive: calculation.isActive,
        };
      },
      async findCounterpartyById(id: string) {
        return counterpartyReads.findById(id);
      },
      async findCurrencyById(id: string) {
        return input.currencies.findById(id);
      },
      async findCustomerById(id: string) {
        return customerReads.findById(id);
      },
      async listActiveAgreementsByCustomerId(customerId: string) {
        const result = await agreementReadsWithCurrencies.list({
          customerId,
          isActive: true,
          limit: 10,
          offset: 0,
          sortBy: "createdAt",
          sortOrder: "desc",
        });

        return result.data.map((agreement) => ({
          id: agreement.id,
          customerId: agreement.customerId,
          organizationId: agreement.organizationId,
          isActive: agreement.isActive,
        }));
      },
      validateSupportedCreateType(type) {
        if (type !== "payment") {
          throw new DealTypeNotSupportedError(type);
        }
      },
    },
    commandUow: new DrizzleDealsUnitOfWork({ persistence }),
  });
}
