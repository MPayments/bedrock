export {
  compilePack,
  validatePackDefinition,
} from "./application/packs";
export type {
  AccountingCompiledPackCache,
  AccountingPacksRepository,
  AccountingPacksServicePorts,
} from "./application/packs/ports";
export { createDrizzleAccountingPacksRepository } from "./infra/drizzle/repos/packs-repository";
export { createInMemoryAccountingCompiledPackCache } from "./infra/packs/in-memory-compiled-pack-cache";

import type { AccountingPacksService } from "./application/packs";
import { createAccountingPacksHandlers } from "./application/packs";
import type { AccountingPacksServicePorts } from "./application/packs/ports";
import type { AccountingPackDefinition } from "./domain/packs";

export interface AccountingPacksServiceDeps extends AccountingPacksServicePorts {
  defaultPackDefinition: AccountingPackDefinition;
}

export function createAccountingPacksService(
  deps: AccountingPacksServiceDeps,
): AccountingPacksService {
  return createAccountingPacksHandlers(deps);
}

export type {
  AccountingPackDefinition,
  CompiledPack,
  DocumentPostingPlan,
  DocumentPostingPlanRequest,
  ResolvePostingPlanInput,
  ResolvePostingPlanResult,
  ResolvedPostingTemplate,
  ValueBinding,
} from "./domain/packs";
export type { AccountingPacksService } from "./application/packs";
