import { describe, expect, test } from "bun:test";
import {
  createApp,
  defineModule,
  defineWorker,
  defineWorkerTrigger,
} from "@bedrock/core";
import { z } from "zod";

import { createIntervalWorkerAdapter, intervalSource } from "./index";

describe("@bedrock/worker-interval", () => {
  test("fires scheduled workers on interval", async () => {
    const fired: string[] = [];
    const adapter = createIntervalWorkerAdapter();
    const worker = defineWorker("tick", {
      payload: z.undefined(),
      handler: async () => {
        fired.push("tick");
      },
    });
    const trigger = defineWorkerTrigger("tick-schedule", {
      source: intervalSource({
        everyMs: 20,
      }),
      worker,
    });

    const app = createApp({
      modules: [
        defineModule("tick", {
          workers: [worker],
          workerTriggers: [trigger],
        }),
      ],
      workerAdapters: [adapter],
    });

    await app.start();
    await new Promise((resolve) => setTimeout(resolve, 55));
    await app.stop();

    expect(fired.length).toBeGreaterThanOrEqual(2);
  });
});
