import type { WorkerLoopObserver } from "@bedrock/kernel/worker-loop";

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
  intervalMs: number;
  runOnce: (ctx: WorkerRunContext) => Promise<WorkerRunResult>;
}

export interface WorkerCatalogEntry {
  id: string;
  envKey: string;
  defaultIntervalMs: number;
  description: string;
}

export interface WorkerFleetBuildInput {
  catalog: readonly WorkerCatalogEntry[];
  workerImplementations: Record<string, BedrockWorker>;
  selectedWorkerIds?: readonly string[];
}

export interface WorkerFleetStartInput {
  appName: string;
  workers: BedrockWorker[];
  createObserver?: (worker: BedrockWorker) => WorkerLoopObserver | undefined;
}

export interface StartedWorkerFleet {
  workers: BedrockWorker[];
  stop: () => void;
  promise: Promise<void>;
}
