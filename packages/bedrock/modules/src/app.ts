import type { Logger } from "@bedrock/common";
import type { Database } from "@bedrock/sql/ports";

import { createModuleRuntimeService } from "./service";
import type {
  ModuleManifest,
  ModuleRuntimeService,
  ModuleRuntimeServiceDeps,
} from "./types";
import {
  createWorkerFleet,
  listWorkerCatalogEntries,
  startWorkerFleet,
} from "./worker-runtime/service";
import type {
  BedrockWorker,
  StartedWorkerFleet,
  WorkerFleetStartInput,
} from "./worker-runtime/types";

export interface WorkerDefinition {
  id: string;
  envKey: string;
  defaultIntervalMs: number;
  description: string;
}

export interface ApiContribution {
  routePath: string;
  guarded?: boolean;
  registerRoutes?: (runtime: BedrockAppRuntime) => unknown;
}

export interface BedrockModuleDefinition {
  id: string;
  version: number;
  kind: "framework" | "domain";
  dependsOn?: string[];
  workers?: readonly WorkerDefinition[];
  api?: ApiContribution;
  manifest?: ModuleManifest;
  services?: Record<string, unknown>;
}

export interface CompileModuleGraphResult {
  modules: BedrockModuleDefinition[];
  manifests: readonly ModuleManifest[];
}

export interface BedrockAppRuntime {
  db: Database;
  logger?: Logger;
  modules: BedrockModuleDefinition[];
  manifests: readonly ModuleManifest[];
  moduleRuntime: ModuleRuntimeService;
  services: Record<string, unknown>;
  createWorkerFleet: (input: {
    workerImplementations: Record<string, BedrockWorker>;
    selectedWorkerIds?: readonly string[];
  }) => BedrockWorker[];
  startWorkerFleet: (
    input: Omit<WorkerFleetStartInput, "workers" | "moduleRuntime"> & {
      workers: BedrockWorker[];
    },
  ) => StartedWorkerFleet;
}

function toManifest(definition: BedrockModuleDefinition): ModuleManifest {
  if (definition.manifest) {
    return definition.manifest;
  }

  return {
    id: definition.id,
    version: definition.version,
    kind: definition.kind === "framework" ? "kernel" : "domain",
    mutability: definition.kind === "framework" ? "immutable" : "mutable",
    description: `${definition.id} module`,
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },
    capabilities: {
      api: definition.api
        ? {
            version: "v1",
            routePath: definition.api.routePath,
            guarded: definition.api.guarded,
          }
        : undefined,
      workers: definition.workers?.map((worker) => ({
        id: worker.id,
        envKey: worker.envKey,
        defaultIntervalMs: worker.defaultIntervalMs,
        description: worker.description,
      })),
    },
    dependencies: (definition.dependsOn ?? []).map((moduleId) => ({
      moduleId,
      reason: `${definition.id} depends on ${moduleId}`,
    })),
  };
}

export function defineModule<T extends BedrockModuleDefinition>(
  definition: T,
): T {
  return definition;
}

export function compileModuleGraph(
  modules: readonly BedrockModuleDefinition[],
): CompileModuleGraphResult {
  const byId = new Map(modules.map((module) => [module.id, module]));
  const ordered: BedrockModuleDefinition[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(moduleId: string) {
    if (visited.has(moduleId)) {
      return;
    }
    if (visiting.has(moduleId)) {
      throw new Error(`Module dependency cycle detected at ${moduleId}`);
    }

    const module = byId.get(moduleId);
    if (!module) {
      throw new Error(`Unknown module dependency: ${moduleId}`);
    }

    visiting.add(moduleId);
    for (const dependency of module.dependsOn ?? []) {
      visit(dependency);
    }
    visiting.delete(moduleId);
    visited.add(moduleId);
    ordered.push(module);
  }

  for (const module of modules) {
    visit(module.id);
  }

  return {
    modules: ordered,
    manifests: ordered.map(toManifest),
  };
}

export function createWorkerRuntime(input: {
  manifests: readonly ModuleManifest[];
  workerImplementations: Record<string, BedrockWorker>;
  selectedWorkerIds?: readonly string[];
}) {
  const workers = createWorkerFleet({
    manifests: input.manifests,
    workerImplementations: input.workerImplementations,
    selectedWorkerIds: input.selectedWorkerIds,
  });

  return {
    workers,
    start: (
      startInput: Omit<WorkerFleetStartInput, "workers" | "moduleRuntime"> & {
        moduleRuntime: WorkerFleetStartInput["moduleRuntime"];
      },
    ) =>
      startWorkerFleet({
        ...startInput,
        workers,
      }),
  };
}

export function createBedrockApp(input: {
  db: Database;
  logger?: Logger;
  modules: readonly BedrockModuleDefinition[];
  createServices?: (ctx: {
    db: Database;
    logger?: Logger;
    manifests: readonly ModuleManifest[];
    moduleRuntime: ModuleRuntimeService;
    modules: BedrockModuleDefinition[];
  }) => Record<string, unknown>;
  moduleRuntime?: Omit<ModuleRuntimeServiceDeps, "db" | "logger" | "manifests">;
}) {
  const graph = compileModuleGraph(input.modules);
  const moduleRuntime = createModuleRuntimeService({
    db: input.db,
    logger: input.logger,
    manifests: graph.manifests,
    ...input.moduleRuntime,
  });

  const runtime: BedrockAppRuntime = {
    db: input.db,
    logger: input.logger,
    modules: graph.modules,
    manifests: graph.manifests,
    moduleRuntime,
    services:
      input.createServices?.({
        db: input.db,
        logger: input.logger,
        manifests: graph.manifests,
        moduleRuntime,
        modules: graph.modules,
      }) ?? {},
    createWorkerFleet: ({ workerImplementations, selectedWorkerIds }) =>
      createWorkerFleet({
        manifests: graph.manifests,
        workerImplementations,
        selectedWorkerIds,
      }),
    startWorkerFleet: ({ workers, ...startInput }) =>
      startWorkerFleet({
        ...startInput,
        workers,
        moduleRuntime,
      }),
  };

  return runtime;
}

export { listWorkerCatalogEntries };
