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
