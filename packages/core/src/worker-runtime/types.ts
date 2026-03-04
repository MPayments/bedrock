import type { WorkerLoopObserver } from "@bedrock/kernel";

import type { ModuleManifest } from "../module-runtime";

export interface WorkerRunContext {
  now: Date;
  signal: AbortSignal;
}

export interface WorkerRunResult {
  processed: number;
  blocked?: number;
}

export interface BedrockWorker {
  id: string;
  moduleId: string;
  intervalMs: number;
  runOnce: (ctx: WorkerRunContext) => Promise<WorkerRunResult>;
}

export interface WorkerCatalogEntry {
  id: string;
  moduleId: string;
  envKey: string;
  defaultIntervalMs: number;
  description: string;
}

export interface WorkerFleetBuildInput {
  manifests: ModuleManifest[];
  workerImplementations: Record<string, BedrockWorker>;
  selectedWorkerIds?: readonly string[];
}

export interface WorkerFleetStartInput {
  appName: string;
  workers: BedrockWorker[];
  moduleRuntime: {
    isModuleEnabled: (input: {
      moduleId: string;
      bookId?: string;
    }) => Promise<boolean>;
  };
  createObserver?: (worker: BedrockWorker) => WorkerLoopObserver | undefined;
}

export interface StartedWorkerFleet {
  workers: BedrockWorker[];
  stop: () => void;
  promise: Promise<void>;
}
