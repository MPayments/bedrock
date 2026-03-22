import type { ModuleRuntime } from "@bedrock/shared/core";

import { ActivatePackForScopeCommand } from "./commands/activate-pack-for-scope";
import { StorePackVersionCommand } from "./commands/store-pack-version";
import type {
  ActivatePackForScopeInput,
  StorePackVersionInput,
} from "./contracts/commands";
import type {
  LoadActivePackForBookInput,
  ResolvePostingPlanQueryInput,
} from "./contracts/queries";
import type { CompiledPackCache } from "./ports/compiled-pack.cache";
import type { InternalLedgerOrganizationsPort } from "./ports/internal-ledger-organizations.port";
import type { PackReads } from "./ports/pack.reads";
import type { PacksCommandUnitOfWork } from "./ports/packs.uow";
import { GetDefaultCompiledPackQuery } from "./queries/get-default-compiled-pack";
import { LoadActivePackForBookQuery } from "./queries/load-active-pack-for-book";
import { LoadPackByChecksumQuery } from "./queries/load-pack-by-checksum";
import { ResolvePostingPlanQuery } from "./queries/resolve-posting-plan";
import {
  compilePack as compileDomainPack,
  type AccountingPackDefinition,
  type CompiledPack,
  type PackReferenceValidationInput,
  type ResolvePostingPlanInput,
  type ResolvePostingPlanResult,
  validatePackDefinition as validateDomainPackDefinition,
} from "../domain";
import { AccountingPackDefinitionSchema } from "../schema";
import { rethrowAccountingPacksDomainError } from "./map-domain-error";

export interface AccountingPacksService {
  compilePack: typeof compilePack;
  getDefaultCompiledPack: () => CompiledPack;
  activatePackForScope: (input: ActivatePackForScopeInput) => Promise<{
    packChecksum: string;
    scopeId: string;
    scopeType: string;
    effectiveAt: Date;
  }>;
  loadActiveCompiledPackForBook: (
    input?: LoadActivePackForBookInput,
  ) => Promise<CompiledPack>;
  storeCompiledPackVersion: (input: StorePackVersionInput) => Promise<CompiledPack>;
  resolvePostingPlan: (
    input: ResolvePostingPlanInput | ResolvePostingPlanQueryInput,
  ) => Promise<ResolvePostingPlanResult>;
  validatePackDefinition: typeof validatePackDefinition;
}

export function compilePack(
  definition: AccountingPackDefinition,
): CompiledPack {
  const validated = AccountingPackDefinitionSchema.parse(definition);

  try {
    return compileDomainPack(validated);
  } catch (error) {
    rethrowAccountingPacksDomainError(error);
  }
}

export function validatePackDefinition(
  definition: AccountingPackDefinition,
  referenceData?: PackReferenceValidationInput,
) {
  const validated = AccountingPackDefinitionSchema.parse(definition);
  return validateDomainPackDefinition(validated, referenceData);
}

export interface PacksServiceDeps {
  runtime: ModuleRuntime;
  commandUow: PacksCommandUnitOfWork;
  defaultPackDefinition: AccountingPackDefinition;
  reads?: PackReads;
  cache?: CompiledPackCache;
  internalLedgerOrganizations?: InternalLedgerOrganizationsPort;
}

export function createPacksService(deps: PacksServiceDeps): {
  commands: {
    activatePackForScope: AccountingPacksService["activatePackForScope"];
    storePackVersion: AccountingPacksService["storeCompiledPackVersion"];
  };
  queries: {
    getDefaultCompiledPack: AccountingPacksService["getDefaultCompiledPack"];
    loadPackByChecksum: (checksum: string) => Promise<CompiledPack | null>;
    loadActivePackForBook: AccountingPacksService["loadActiveCompiledPackForBook"];
    resolvePostingPlan: AccountingPacksService["resolvePostingPlan"];
  };
  compilePack: typeof compilePack;
  validatePackDefinition: typeof validatePackDefinition;
} {
  const defaultCompiledPack = compilePack(deps.defaultPackDefinition);
  const getDefaultCompiledPack = new GetDefaultCompiledPackQuery(
    defaultCompiledPack,
  );
  const loadPackByChecksum = deps.reads
    ? new LoadPackByChecksumQuery(deps.reads, deps.cache)
    : null;
  const loadActivePackForBook = new LoadActivePackForBookQuery(
    deps.runtime,
    deps.reads,
    defaultCompiledPack,
    loadPackByChecksum?.execute.bind(loadPackByChecksum) ?? (async () => null),
    deps.cache,
  );
  const storePackVersion = new StorePackVersionCommand(
    deps.runtime,
    deps.commandUow,
    defaultCompiledPack,
    deps.cache,
  );
  const activatePackForScope = new ActivatePackForScopeCommand(
    deps.runtime,
    deps.commandUow,
    loadPackByChecksum?.execute.bind(loadPackByChecksum) ?? (async () => null),
    deps.cache,
  );
  const resolvePostingPlanQuery = new ResolvePostingPlanQuery(
    loadActivePackForBook.execute.bind(loadActivePackForBook) as never,
    deps.internalLedgerOrganizations,
  );

  return {
    compilePack,
    validatePackDefinition,
    commands: {
      activatePackForScope:
        activatePackForScope.execute.bind(activatePackForScope),
      storePackVersion: storePackVersion.execute.bind(storePackVersion),
    },
    queries: {
      getDefaultCompiledPack: getDefaultCompiledPack.execute.bind(
        getDefaultCompiledPack,
      ),
      loadPackByChecksum:
        loadPackByChecksum?.execute.bind(loadPackByChecksum) ??
        (async () => null),
      loadActivePackForBook: loadActivePackForBook.execute.bind(
        loadActivePackForBook,
      ),
      resolvePostingPlan: resolvePostingPlanQuery.execute.bind(
        resolvePostingPlanQuery,
      ),
    },
  };
}
