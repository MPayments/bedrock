import { Worker, type Job } from "bullmq";

import type { Logger } from "@bedrock/platform/observability/logger";
import type { IntegrationEventHandler } from "@bedrock/workflow-integration-mpayments";

export interface IntegrationConsumerDeps {
  handler: IntegrationEventHandler;
  logger: Logger;
  redisHost: string;
  redisPort: number;
  redisUser?: string;
  redisPassword?: string;
}

export interface IntegrationConsumer {
  close(): Promise<void>;
}

export function createIntegrationConsumer(
  deps: IntegrationConsumerDeps,
): IntegrationConsumer {
  const worker = new Worker(
    "integration",
    async (job: Job) => {
      deps.logger.info("Processing integration event", {
        jobId: job.id,
        entity: job.data?.entity,
        action: job.data?.action,
      });

      await deps.handler.processEvent(job.data);
    },
    {
      connection: {
        host: deps.redisHost,
        port: deps.redisPort,
        username: deps.redisUser,
        password: deps.redisPassword,
      },
    },
  );

  worker.on("failed", (job, error) => {
    deps.logger.error("Integration event processing failed", {
      jobId: job?.id,
      error: error.message,
    });
  });

  worker.on("error", (error) => {
    deps.logger.error("Integration consumer error", {
      error: error.message,
    });
  });

  deps.logger.info("Integration consumer started", {
    queue: "integration",
    redisHost: deps.redisHost,
    redisPort: deps.redisPort,
  });

  return {
    async close() {
      await worker.close();
      deps.logger.info("Integration consumer stopped");
    },
  };
}
