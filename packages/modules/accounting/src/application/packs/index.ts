import {
  createActivatePackForScopeCommand,
  createStoreCompiledPackVersionCommand,
} from "./commands";
import type { AccountingPacksServicePorts } from "./ports";
import {
  createLoadActiveCompiledPackForBookQuery,
  createLoadCompiledPackByChecksumQuery,
  createResolvePostingPlanQuery,
} from "./queries";
import { type AccountingPacksContext } from "./types";
import {
  compilePack,
  type CompiledPack,
  type ResolvePostingPlanInput,
  type ResolvePostingPlanResult,
  validatePackDefinition,
} from "../../domain/packs";
import type { AccountingPackDefinition } from "../../packs/schema";

export interface AccountingPacksService {
  compilePack: typeof compilePack;
  getDefaultCompiledPack: () => CompiledPack;
  activatePackForScope: (input: {
    scopeId: string;
    packChecksum: string;
    effectiveAt?: Date;
    scopeType?: string;
  }) => Promise<{
    packChecksum: string;
    scopeId: string;
    scopeType: string;
    effectiveAt: Date;
  }>;
  loadActiveCompiledPackForBook: (input?: {
    bookId?: string;
    at?: Date;
  }) => Promise<CompiledPack>;
  storeCompiledPackVersion: (input: {
    definition?: AccountingPackDefinition;
    pack?: CompiledPack;
  }) => Promise<CompiledPack>;
  resolvePostingPlan: (
    input: ResolvePostingPlanInput,
  ) => Promise<ResolvePostingPlanResult>;
  validatePackDefinition: typeof validatePackDefinition;
}

export { compilePack, validatePackDefinition };

export function createAccountingPacksHandlers(
  deps: {
    defaultPackDefinition: AccountingPackDefinition;
  } & AccountingPacksServicePorts,
): AccountingPacksService {
  const defaultCompiledPack = compilePack(deps.defaultPackDefinition);
  const context: AccountingPacksContext = {
    defaultCompiledPack,
    packCache: new Map(),
    repository: deps.repository,
    withTransaction: deps.withTransaction,
    assertBooksBelongToInternalLedgerOrganizations:
      deps.assertBooksBelongToInternalLedgerOrganizations,
  };

  const loadCompiledPackByChecksum = createLoadCompiledPackByChecksumQuery({
    context,
  });
  const storeCompiledPackVersion = createStoreCompiledPackVersionCommand({
    context,
  });
  const activatePackForScope = createActivatePackForScopeCommand({
    context,
    loadCompiledPackByChecksum,
  });
  const loadActiveCompiledPackForBook = createLoadActiveCompiledPackForBookQuery({
    context,
    loadCompiledPackByChecksum,
  });
  const resolvePostingPlan = createResolvePostingPlanQuery({
    context,
    loadActiveCompiledPackForBook,
  });

  return {
    compilePack,
    activatePackForScope,
    getDefaultCompiledPack: () => defaultCompiledPack,
    loadActiveCompiledPackForBook,
    storeCompiledPackVersion,
    resolvePostingPlan,
    validatePackDefinition,
  };
}
