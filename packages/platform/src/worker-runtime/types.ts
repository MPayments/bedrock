import type { WorkerLoopObserver } from "@bedrock/foundation/kernel";

import type { ComponentManifest } from "../component-runtime";

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
  componentId: string;
  intervalMs: number;
  runOnce: (ctx: WorkerRunContext) => Promise<WorkerRunResult>;
}

export interface WorkerCatalogEntry {
  id: string;
  componentId: string;
  envKey: string;
  defaultIntervalMs: number;
  description: string;
}

export interface WorkerFleetBuildInput {
  manifests: ComponentManifest[];
  workerImplementations: Record<string, BedrockWorker>;
  selectedWorkerIds?: readonly string[];
}

export interface WorkerFleetStartInput {
  appName: string;
  workers: BedrockWorker[];
  componentRuntime: {
    isComponentEnabled: (input: {
      componentId: string;
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
