export {
  compilePack,
  validatePackDefinition,
} from "./application/packs/runtime";
import { createOrganizationsQueries } from "@bedrock/organizations/queries";

import type { AccountingRuntime } from "./application/packs/runtime";
import { createAccountingRuntime as createAccountingRuntimeService } from "./application/packs/runtime";
import type { AccountingRuntimeDeps } from "./deps";
import { createDrizzleAccountingPacksRepository } from "./infra/drizzle/repos/packs-repository";

export function createAccountingRuntime(
  deps: AccountingRuntimeDeps,
): AccountingRuntime {
  const repository = deps.db
    ? createDrizzleAccountingPacksRepository(deps.db)
    : undefined;
  const organizationsQueries = deps.db
    ? createOrganizationsQueries({ db: deps.db })
    : undefined;

  return createAccountingRuntimeService({
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
} from "./domain/packs/types";
export type { AccountingRuntime } from "./application/packs/runtime";
