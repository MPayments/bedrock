import { randomUUID } from "node:crypto";

import { noopLogger } from "@bedrock/platform/observability/logger";
import { createPersistenceContext } from "@bedrock/platform/persistence";

import { db, pool } from "./setup";
import { createPartiesModule } from "../../src";
import {
  DrizzleCounterpartyGroupReads,
  DrizzleCounterpartiesQueries,
  DrizzleCounterpartyReads,
  DrizzleCustomerReads,
  DrizzleCustomersQueries,
  DrizzleOrganizationsQueries,
  DrizzleOrganizationReads,
  DrizzlePartyRegistryUnitOfWork,
  DrizzleRequisiteBindingReads,
  DrizzleRequisiteProviderReads,
  DrizzleRequisiteReads,
  DrizzleRequisitesQueries,
} from "../../src/adapters/drizzle";

export function createIntegrationRuntime(options?: {
  hasDocumentsForCustomer?: (customerId: string) => Promise<boolean>;
}) {
  return {
    module: createPartiesModule({
      logger: noopLogger,
      now: () => new Date(),
      generateUuid: randomUUID,
      documents: {
        hasDocumentsForCustomer(customerId) {
          return (
            options?.hasDocumentsForCustomer?.(customerId) ??
            Promise.resolve(false)
          );
        },
      },
      currencies: {
        async assertCurrencyExists(id) {
          const result = await pool.query("select 1 from currencies where id = $1", [
            id,
          ]);

          if (result.rowCount === 0) {
            throw new Error(`Currency not found: ${id}`);
          }
        },
        async listCodesById(ids) {
          const uniqueIds = [...new Set(ids.filter(Boolean))];
          if (uniqueIds.length === 0) {
            return new Map<string, string>();
          }

          const result = await pool.query<{
            id: string;
            code: string;
          }>(
            "select id, code from currencies where id = any($1::uuid[])",
            [uniqueIds],
          );

          return new Map(result.rows.map((row) => [row.id, row.code]));
        },
      },
      customerReads: new DrizzleCustomerReads(db),
      counterpartyReads: new DrizzleCounterpartyReads(db),
      counterpartyGroupReads: new DrizzleCounterpartyGroupReads(db),
      organizationReads: new DrizzleOrganizationReads(db),
      requisiteReads: new DrizzleRequisiteReads(db),
      requisiteProviderReads: new DrizzleRequisiteProviderReads(db),
      requisiteBindingReads: new DrizzleRequisiteBindingReads(db),
      unitOfWork: new DrizzlePartyRegistryUnitOfWork({
        persistence: createPersistenceContext(db),
      }),
    }),
    queries: {
      customers: new DrizzleCustomersQueries(db),
      counterparties: new DrizzleCounterpartiesQueries(db),
      organizations: new DrizzleOrganizationsQueries(db),
      requisites: new DrizzleRequisitesQueries(db),
    },
  };
}
