import type { LedgerBooksService } from "@bedrock/ledger";
import {
  createOrganizationsServiceFromTransaction,
  type OrganizationsServiceTransactionDeps,
} from "@bedrock/organizations";
import type { Logger } from "@bedrock/platform/observability/logger";
import type { Database } from "@bedrock/platform/persistence";

export interface OrganizationBootstrapWorkflowDeps {
  db: Database;
  ledgerBooks: Pick<LedgerBooksService, "ensureDefaultOrganizationBook">;
  logger?: Logger;
  now?: OrganizationsServiceTransactionDeps["now"];
}

export function createOrganizationBootstrapWorkflow(
  deps: OrganizationBootstrapWorkflowDeps,
) {
  return {
    async create(
      input: Parameters<
        ReturnType<typeof createOrganizationsServiceFromTransaction>["create"]
      >[0],
    ) {
      return deps.db.transaction(async (tx) => {
        const organizations = createOrganizationsServiceFromTransaction({
          tx,
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

export type OrganizationBootstrapWorkflow = ReturnType<
  typeof createOrganizationBootstrapWorkflow
>;
