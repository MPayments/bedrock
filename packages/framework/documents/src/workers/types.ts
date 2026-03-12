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
