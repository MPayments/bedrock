import type { WorkerLoopObserver } from "@bedrock/common";

export interface BedrockWorkerDescriptor {
  id: string;
  envKey: string;
  defaultIntervalMs: number;
  description?: string;
}

export interface BedrockWorkerRunContext {
  now: Date;
  signal: AbortSignal;
}

export interface BedrockWorkerRunResult {
  processed: number;
  blocked?: number;
}

export interface BedrockWorker {
  id: string;
  intervalMs: number;
  runOnce: (
    ctx: BedrockWorkerRunContext,
  ) => Promise<BedrockWorkerRunResult>;
}

export interface CreateWorkerFleetInput {
  workers: Record<string, BedrockWorker>;
  selectedWorkerIds?: readonly string[];
}

export interface StartWorkerFleetInput {
  appName: string;
  workers: readonly BedrockWorker[];
  createObserver?: (worker: BedrockWorker) => WorkerLoopObserver | undefined;
}

export interface StartedWorkerFleet {
  workers: readonly BedrockWorker[];
  stop: () => void;
  promise: Promise<void>;
}
