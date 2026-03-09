import { createLedgerEngine } from "./engine";
import type { LedgerDeps } from "./internal/context";
import { createLedgerReadService } from "./read-service";
import type { OperationIntent } from "./types";

export interface LedgerAccountDefinition<TScope = unknown> {
  name: string;
  code: number;
  normal: "debit" | "credit";
  asset: readonly string[];
  scope: TScope;
  limits?: Record<string, unknown>;
}

export interface LedgerPostingDefinition<TParams = unknown> {
  name: string;
  params: TParams;
  mode?: "posted" | "pending";
  build: (helpers: Record<string, unknown>, params: TParams) => unknown;
}

export function defineAccount<TScope>(
  name: string,
  definition: Omit<LedgerAccountDefinition<TScope>, "name">,
): LedgerAccountDefinition<TScope> {
  return {
    name,
    ...definition,
  };
}

export function definePosting<TParams>(
  name: string,
  definition: Omit<LedgerPostingDefinition<TParams>, "name">,
): LedgerPostingDefinition<TParams> {
  return {
    name,
    ...definition,
  };
}

export function ref<TScope>(
  account: LedgerAccountDefinition<TScope>,
  scope: TScope,
) {
  return {
    account,
    scope,
  };
}

export function createLedgerRuntime(deps: LedgerDeps) {
  const engine = createLedgerEngine(deps);
  const readService = createLedgerReadService(deps);

  return {
    engine,
    readService,
    submitPostingBatch(intent: OperationIntent) {
      return engine.commitStandalone(intent);
    },
    async lookupBalances() {
      return [];
    },
  };
}
