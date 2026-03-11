import type { WorkerLoopObserver } from "@multihansa/common";

export interface WorkerDescriptor {
  id: string;
  envKey: string;
  defaultIntervalMs: number;
  description?: string;
}

export interface WorkerRunContext {
  now: Date;
  signal: AbortSignal;
}

export interface WorkerRunResult {
  processed: number;
  blocked?: number;
}

export interface Worker {
  id: string;
  intervalMs: number;
  runOnce: (
    ctx: WorkerRunContext,
  ) => Promise<WorkerRunResult>;
}

export interface CreateWorkerFleetInput {
  workers: Record<string, Worker>;
  selectedWorkerIds?: readonly string[];
}

export interface StartWorkerFleetInput {
  appName: string;
  workers: readonly Worker[];
  createObserver?: (worker: Worker) => WorkerLoopObserver | undefined;
}

export interface StartedWorkerFleet {
  workers: readonly Worker[];
  stop: () => void;
  promise: Promise<void>;
}
