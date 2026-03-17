import type { LedgerBooksService } from "@bedrock/ledger";
import {
  createOrganizationsService,
  type OrganizationsServiceDeps,
} from "@bedrock/organizations";
import type {
  CreateOrganizationInput,
  Organization,
} from "@bedrock/organizations/contracts";
import type { Logger } from "@bedrock/platform/observability/logger";
import {
  bindPersistenceSession,
  type Database,
} from "@bedrock/platform/persistence";

export interface OrganizationBootstrapWorkflowDeps {
  db: Database;
  ledgerBooks: Pick<LedgerBooksService, "ensureDefaultOrganizationBook">;
  logger?: Logger;
  now?: OrganizationsServiceDeps["now"];
}

export interface OrganizationBootstrapWorkflow {
  create(input: CreateOrganizationInput): Promise<Organization>;
}

export function createOrganizationBootstrapWorkflow(
  deps: OrganizationBootstrapWorkflowDeps,
): OrganizationBootstrapWorkflow {
  return {
    async create(input) {
      return deps.db.transaction(async (tx) => {
        const organizations = createOrganizationsService({
          persistence: bindPersistenceSession(tx),
          logger: deps.logger,
          now: deps.now,
        });
        const organization = await organizations.create(input);

        await deps.ledgerBooks.ensureDefaultOrganizationBook(tx, {
          organizationId: organization.id,
        });

        return organization;
      });
    },
  };
}
