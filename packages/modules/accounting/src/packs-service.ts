export {
  compilePack,
  validatePackDefinition,
} from "./application/packs";
import { createOrganizationsQueries } from "@bedrock/organizations/queries";
import type { Database } from "@bedrock/platform/persistence";

import type { AccountingPacksService } from "./application/packs";
import { createAccountingPacksHandlers } from "./application/packs";
import { createDrizzleAccountingPacksRepository } from "./infra/drizzle/repos/packs-repository";
import type { AccountingPackDefinition } from "./packs/schema";

export interface AccountingPacksServiceDeps {
  db?: Database;
  defaultPackDefinition: AccountingPackDefinition;
}

export function createAccountingPacksService(
  deps: AccountingPacksServiceDeps,
): AccountingPacksService {
  const repository = deps.db
    ? createDrizzleAccountingPacksRepository(deps.db)
    : undefined;
  const organizationsQueries = deps.db
    ? createOrganizationsQueries({ db: deps.db })
    : undefined;

  return createAccountingPacksHandlers({
    defaultPackDefinition: deps.defaultPackDefinition,
    repository,
    withTransaction: deps.db
      ? async (run) =>
          deps.db!.transaction(async (tx) =>
            run(createDrizzleAccountingPacksRepository(tx)),
          )
      : undefined,
    assertBooksBelongToInternalLedgerOrganizations:
      organizationsQueries?.assertBooksBelongToInternalLedgerOrganizations,
  });
}

export type {
  CompiledPack,
  DocumentPostingPlan,
  DocumentPostingPlanRequest,
  ResolvePostingPlanInput,
  ResolvePostingPlanResult,
  ResolvedPostingTemplate,
} from "./domain/packs";
export type { AccountingPacksService } from "./application/packs";
