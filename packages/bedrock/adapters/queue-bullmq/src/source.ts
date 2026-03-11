import type { z } from "zod";

import type { WorkerSourceDescriptor } from "@bedrock/core";

import type { BullmqDispatchJobOptions, BullmqDispatchSourceConfig } from "./adapter";

export function bullmqDispatchSource<TInputSchema extends z.ZodTypeAny>(options: {
  queue: string;
  input: TInputSchema;
  jobName?: string;
  jobOptions?: BullmqDispatchJobOptions;
}): WorkerSourceDescriptor<"dispatch", TInputSchema, BullmqDispatchSourceConfig> {
  return Object.freeze({
    kind: "worker-source" as const,
    trigger: "dispatch" as const,
    adapter: "bullmq",
    input: options.input,
    config: Object.freeze({
      queue: options.queue,
      jobName: options.jobName,
      jobOptions: options.jobOptions,
    }),
  });
}
