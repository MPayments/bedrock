import { randomUUID } from "node:crypto";

import type { LedgerModule } from "@bedrock/ledger";
import { DrizzleHoldingOrganizationBridge } from "@bedrock/operations/adapters/drizzle";
import {
  createPartiesModule,
  type PartiesModuleDeps,
} from "@bedrock/parties";
import {
  DrizzleCounterpartyGroupReads,
  DrizzleCounterpartyReads,
  DrizzleCustomerReads,
  DrizzleOrganizationReads,
  DrizzlePartyRegistryUnitOfWork,
  DrizzleRequisiteBindingReads,
  DrizzleRequisiteProviderReads,
  DrizzleRequisiteReads,
} from "@bedrock/parties/adapters/drizzle";
import type {
  CreateOrganizationInput,
  Organization,
} from "@bedrock/parties/contracts";
import { noopLogger, type Logger } from "@bedrock/platform/observability/logger";
import {
  bindPersistenceSession,
  type Database,
  type Transaction,
} from "@bedrock/platform/persistence";

export interface OrganizationBootstrapWorkflowDeps {
  db: Database;
  createLedgerModule(tx: Transaction): Pick<LedgerModule, "books">;
  logger?: Logger;
  now?: PartiesModuleDeps["now"];
}

export interface OrganizationBootstrapWorkflow {
  create(input: CreateOrganizationInput): Promise<Organization>;
}

function createWorkflowPartiesModule(input: {
  tx: Transaction;
  logger?: Logger;
  now?: PartiesModuleDeps["now"];
}) {
  return createPartiesModule({
    logger: input.logger ?? noopLogger,
    now: input.now ?? (() => new Date()),
    generateUuid: randomUUID,
    documents: {
      hasDocumentsForCustomer: async () => false,
    },
    currencies: {
      async assertCurrencyExists() {
        throw new Error(
          "Currencies are not available in organization bootstrap workflow",
        );
      },
      async listCodesById() {
        return new Map();
      },
    },
    customerReads: new DrizzleCustomerReads(input.tx),
    counterpartyReads: new DrizzleCounterpartyReads(input.tx),
    counterpartyGroupReads: new DrizzleCounterpartyGroupReads(input.tx),
    organizationReads: new DrizzleOrganizationReads(input.tx),
    requisiteReads: new DrizzleRequisiteReads(input.tx),
    requisiteProviderReads: new DrizzleRequisiteProviderReads(input.tx),
    requisiteBindingReads: new DrizzleRequisiteBindingReads(input.tx),
    unitOfWork: new DrizzlePartyRegistryUnitOfWork({
      persistence: bindPersistenceSession(input.tx),
    }),
  });
}

export function createOrganizationBootstrapWorkflow(
  deps: OrganizationBootstrapWorkflowDeps,
): OrganizationBootstrapWorkflow {
  return {
    async create(input) {
      return deps.db.transaction(async (tx) => {
        const partiesModule = createWorkflowPartiesModule({
          tx,
          logger: deps.logger,
          now: deps.now,
        });
        const ledgerModule = deps.createLedgerModule(tx);
        const organization =
          await partiesModule.organizations.commands.create(input);
        const holdingOrganizationBridge = new DrizzleHoldingOrganizationBridge(tx);

        await holdingOrganizationBridge.upsertFromCanonical(organization);

        await ledgerModule.books.commands.ensureDefaultOrganizationBook({
          organizationId: organization.id,
        });

        return organization;
      });
    },
  };
}
