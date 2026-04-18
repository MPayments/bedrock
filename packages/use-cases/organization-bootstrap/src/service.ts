import type { LedgerModule } from "@bedrock/ledger";
import type { PartiesModuleDeps } from "@bedrock/parties";
import {
  createPartiesModuleFromDrizzle,
  type CreatePartiesModuleFromDrizzleInput,
} from "@bedrock/parties/adapters/drizzle";
import type {
  CreateOrganizationInput,
  Organization,
} from "@bedrock/parties/contracts";
import { noopLogger, type Logger } from "@bedrock/platform/observability/logger";
import type {
  Database,
  Transaction,
} from "@bedrock/platform/persistence";

function createWorkflowPartiesModule(input: {
  tx: Transaction;
  logger?: Logger;
  now?: PartiesModuleDeps["now"];
}) {
  return createPartiesModuleFromDrizzle({
    currencies: {
      async assertCurrencyExists() {
        throw new Error(
          "Currencies are not available in organization bootstrap use-case",
        );
      },
      async findByCode() {
        throw new Error(
          "Currencies are not available in organization bootstrap use-case",
        );
      },
      async listCodesById() {
        return new Map();
      },
    },
    db: input.tx,
    documents: {
      hasDocumentsForCustomer: async () => false,
    },
    logger: input.logger ?? noopLogger,
    now: input.now,
  } satisfies CreatePartiesModuleFromDrizzleInput);
}

export interface CreateOrganizationBootstrapServiceInput {
  db: Database;
  createLedgerModule(tx: Transaction): Pick<LedgerModule, "books">;
  logger?: Logger;
  now?: PartiesModuleDeps["now"];
}

export interface OrganizationBootstrapService {
  create(input: CreateOrganizationInput): Promise<Organization>;
}

export function createOrganizationBootstrapService(
  deps: CreateOrganizationBootstrapServiceInput,
): OrganizationBootstrapService {
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

        await ledgerModule.books.commands.ensureDefaultOrganizationBook({
          organizationId: organization.id,
        });

        return organization;
      });
    },
  };
}
