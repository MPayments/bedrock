import type { ModuleRuntime } from "@bedrock/shared/core";

import type {
  TreasuryCoreReads,
  TreasuryCoreUnitOfWork,
} from "./core-ports";

export interface TreasuryCoreServiceContext {
  reads: TreasuryCoreReads;
  runtime: ModuleRuntime;
  unitOfWork: TreasuryCoreUnitOfWork;
}

export interface TreasuryCoreServiceDeps {
  reads: TreasuryCoreReads;
  runtime: ModuleRuntime;
  unitOfWork: TreasuryCoreUnitOfWork;
}

export function createTreasuryCoreServiceContext(
  deps: TreasuryCoreServiceDeps,
): TreasuryCoreServiceContext {
  return {
    reads: deps.reads,
    runtime: deps.runtime,
    unitOfWork: deps.unitOfWork,
  };
}
