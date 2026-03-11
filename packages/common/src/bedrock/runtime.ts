import type { Database } from "../sql/ports";
import { token } from "@bedrock/core";

export type WorkerRunObserver = {
  onLoopStarted?: () => void;
  onTickStarted?: () => void;
  onTickSucceeded?: (input: {
    durationMs: number;
    processed: number;
    result: unknown;
  }) => void;
  onTickFailed?: (input: {
    durationMs: number;
    error: unknown;
  }) => void;
  onLoopStopped?: () => void;
};

export const DbToken = token<Database>("multihansa.db");
export const TbClientToken = token<unknown>("multihansa.tb-client");
export const WorkerIntervalsToken = token<Record<string, number>>(
  "multihansa.worker-intervals",
);
export const WorkerObserversToken = token<Record<string, WorkerRunObserver | undefined>>(
  "multihansa.worker-observers",
);
export const AppNameToken = token<string>("multihansa.app-name");
