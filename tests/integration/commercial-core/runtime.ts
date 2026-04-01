import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { createAgreementsModule } from "../../../packages/modules/agreements/src";
import { DrizzleAgreementReads, DrizzleAgreementsUnitOfWork } from "../../../packages/modules/agreements/src/adapters/drizzle";
import { agreements } from "../../../packages/modules/agreements/src/schema";
import { createCalculationsModule } from "../../../packages/modules/calculations/src";
import { DrizzleCalculationReads, DrizzleCalculationsUnitOfWork } from "../../../packages/modules/calculations/src/adapters/drizzle";
import { createCurrenciesQueries } from "../../../packages/modules/currencies/src/queries";
import { currencies } from "../../../packages/modules/currencies/src/infra/drizzle/schema/index";
import { createDealsModule } from "../../../packages/modules/deals/src";
import { DrizzleDealReads, DrizzleDealsUnitOfWork } from "../../../packages/modules/deals/src/adapters/drizzle";
import { createPartiesModule } from "../../../packages/modules/parties/src";
import {
  DrizzleCounterpartyGroupReads,
  DrizzleCounterpartyReads,
  DrizzleCustomerReads,
  DrizzleOrganizationReads,
  DrizzlePartyRegistryUnitOfWork,
  DrizzleRequisiteBindingReads,
  DrizzleRequisiteProviderReads,
  DrizzleRequisiteReads,
  DrizzleSubAgentProfileReads,
} from "../../../packages/modules/parties/src/adapters/drizzle";
import {
  counterparties,
  customers,
  organizationRequisiteBindings,
  organizations,
  requisites,
} from "../../../packages/modules/parties/src/schema";
import { noopLogger } from "../../../packages/platform/src/observability/logger";
import { createPersistenceContext } from "../../../packages/platform/src/persistence";
import { fxQuotes } from "../../../packages/modules/treasury/src/schema";

import { db, pool } from "./setup";

function createTestClock() {
  let tick = 0;

  return () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++));
}

export function createCommercialCoreRuntime() {
  const now = createTestClock();
  const persistence = createPersistenceContext(db);
  const currenciesQueries = createCurrenciesQueries({ db });
  const agreementReads = new DrizzleAgreementReads(db, currenciesQueries);
  const calculationReads = new DrizzleCalculationReads(db);
  const dealReads = new DrizzleDealReads(db, currenciesQueries);

  const idempotency = {
    async withIdempotencyTx<TResult>({
      handler,
    }: {
      handler: () => Promise<TResult>;
    }) {
      return handler();
    },
  };

  const parties = createPartiesModule({
    logger: noopLogger,
    now,
    generateUuid: randomUUID,
    documents: {
      async hasDocumentsForCustomer() {
        return false;
      },
    },
    currencies: {
      async assertCurrencyExists(id) {
        const [currency] = await db
          .select({ id: currencies.id })
          .from(currencies)
          .where(eq(currencies.id, id))
          .limit(1);

        if (!currency) {
          throw new Error(`Currency not found: ${id}`);
        }
      },
      async listCodesById(ids) {
        const uniqueIds = [...new Set(ids.filter(Boolean))];
        if (uniqueIds.length === 0) {
          return new Map<string, string>();
        }

        const rows = await db
          .select({ code: currencies.code, id: currencies.id })
          .from(currencies);

        return new Map(
          rows
            .filter((row) => uniqueIds.includes(row.id))
            .map((row) => [row.id, row.code]),
        );
      },
    },
    customerReads: new DrizzleCustomerReads(db),
    counterpartyReads: new DrizzleCounterpartyReads(db),
    counterpartyGroupReads: new DrizzleCounterpartyGroupReads(db),
    organizationReads: new DrizzleOrganizationReads(db),
    requisiteReads: new DrizzleRequisiteReads(db),
    requisiteProviderReads: new DrizzleRequisiteProviderReads(db),
    requisiteBindingReads: new DrizzleRequisiteBindingReads(db),
    subAgentProfileReads: new DrizzleSubAgentProfileReads(db),
    unitOfWork: new DrizzlePartyRegistryUnitOfWork({ persistence }),
  });

  const agreementsModule = createAgreementsModule({
    logger: noopLogger,
    now,
    generateUuid: randomUUID,
    idempotency,
    reads: agreementReads,
    references: {
      async assertCurrencyExists(id) {
        const [currency] = await db
          .select({ id: currencies.id })
          .from(currencies)
          .where(eq(currencies.id, id))
          .limit(1);

        if (!currency) {
          throw new Error(`Currency not found: ${id}`);
        }
      },
      async findCustomerById(id) {
        const [row] = await db
          .select({ id: customers.id })
          .from(customers)
          .where(eq(customers.id, id))
          .limit(1);

        return row ?? null;
      },
      async findOrganizationById(id) {
        const [row] = await db
          .select({ id: organizations.id })
          .from(organizations)
          .where(eq(organizations.id, id))
          .limit(1);

        return row ?? null;
      },
      async findOrganizationRequisiteBindingByRequisiteId(requisiteId) {
        const [row] = await db
          .select({ requisiteId: organizationRequisiteBindings.requisiteId })
          .from(organizationRequisiteBindings)
          .where(eq(organizationRequisiteBindings.requisiteId, requisiteId))
          .limit(1);

        return row ?? null;
      },
      async findRequisiteSubjectById(requisiteId) {
        const [row] = await db
          .select({
            id: requisites.id,
            organizationId: requisites.organizationId,
            ownerType: requisites.ownerType,
          })
          .from(requisites)
          .where(eq(requisites.id, requisiteId))
          .limit(1);

        if (!row) {
          return null;
        }

        return {
          id: row.id,
          organizationId: row.organizationId,
          ownerType: row.ownerType,
        };
      },
    },
    commandUow: new DrizzleAgreementsUnitOfWork({ persistence }),
  });

  const calculations = createCalculationsModule({
    logger: noopLogger,
    now,
    generateUuid: randomUUID,
    idempotency,
    reads: calculationReads,
    references: {
      async assertCurrencyExists(id) {
        const [currency] = await db
          .select({ id: currencies.id })
          .from(currencies)
          .where(eq(currencies.id, id))
          .limit(1);

        if (!currency) {
          throw new Error(`Currency not found: ${id}`);
        }
      },
      async findFxQuoteById(id) {
        const [quote] = await db
          .select({
            fromCurrencyId: fxQuotes.fromCurrencyId,
            id: fxQuotes.id,
            rateDen: fxQuotes.rateDen,
            rateNum: fxQuotes.rateNum,
            toCurrencyId: fxQuotes.toCurrencyId,
          })
          .from(fxQuotes)
          .where(eq(fxQuotes.id, id))
          .limit(1);

        return quote ?? null;
      },
    },
    commandUow: new DrizzleCalculationsUnitOfWork({ persistence }),
  });

  const deals = createDealsModule({
    logger: noopLogger,
    now,
    generateUuid: randomUUID,
    idempotency,
    reads: dealReads,
    references: {
      async findAgreementById(id) {
        const agreement = await agreementReads.findById(id);

        if (!agreement) {
          return null;
        }

        return {
          currentVersionId: agreement.currentVersion.id,
          customerId: agreement.customerId,
          id: agreement.id,
          isActive: agreement.isActive,
          organizationId: agreement.organizationId,
        };
      },
      async findCalculationById(id) {
        const calculation = await calculationReads.findById(id);

        if (!calculation) {
          return null;
        }

        return {
          id: calculation.id,
          isActive: calculation.isActive,
        };
      },
      async findCounterpartyById(id) {
        const [counterparty] = await db
          .select({
            customerId: counterparties.customerId,
            fullName: counterparties.fullName,
            id: counterparties.id,
            shortName: counterparties.shortName,
          })
          .from(counterparties)
          .where(eq(counterparties.id, id))
          .limit(1);

        return counterparty ?? null;
      },
      async findCurrencyById(id) {
        const [currency] = await db
          .select({
            code: currencies.code,
            id: currencies.id,
            precision: currencies.precision,
          })
          .from(currencies)
          .where(eq(currencies.id, id))
          .limit(1);

        return currency ?? null;
      },
      async findCustomerById(id) {
        const [row] = await db
          .select({ id: customers.id })
          .from(customers)
          .where(eq(customers.id, id))
          .limit(1);

        return row ?? null;
      },
      async findQuoteById(id) {
        const [quote] = await db
          .select({
            dealId: fxQuotes.dealId,
            expiresAt: fxQuotes.expiresAt,
            id: fxQuotes.id,
            status: fxQuotes.status,
            usedAt: fxQuotes.usedAt,
            usedDocumentId: fxQuotes.usedDocumentId,
          })
          .from(fxQuotes)
          .where(eq(fxQuotes.id, id))
          .limit(1);

        return quote ?? null;
      },
      async listActiveAgreementsByCustomerId(customerId) {
        const rows = await db
          .select({
            currentVersionId: agreements.currentVersionId,
            customerId: agreements.customerId,
            id: agreements.id,
            isActive: agreements.isActive,
            organizationId: agreements.organizationId,
          })
          .from(agreements)
          .where(eq(agreements.customerId, customerId));

        return rows.filter((row) => row.isActive);
      },
      validateSupportedCreateType() {},
    },
    commandUow: new DrizzleDealsUnitOfWork({ persistence }),
  });

  return {
    db,
    modules: {
      agreements: agreementsModule,
      calculations,
      deals,
      parties,
    },
    pool,
    reads: {
      agreements: agreementReads,
      calculations: calculationReads,
      deals: dealReads,
    },
  };
}
