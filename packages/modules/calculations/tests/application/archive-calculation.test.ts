import { describe, expect, it, vi } from "vitest";

import { createModuleRuntime } from "@bedrock/shared/core";

import { ArchiveCalculationCommand } from "../../src/application/commands/archive-calculation";

function createLogger() {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  };
  logger.child.mockReturnValue(logger);
  return logger;
}

describe("archive calculation command", () => {
  it("archives a calculation by toggling isActive to false", async () => {
    const calculationReads = {
      findById: vi.fn(async () => ({ id: "calc-1" })),
    };
    const calculationStore = {
      setActive: vi.fn(async () => undefined),
    };
    const tx = {
      calculationReads,
      calculationStore,
    };
    const commandUow = {
      run: vi.fn(async (work: (value: typeof tx) => Promise<unknown>) => work(tx)),
    };
    const runtime = createModuleRuntime({
      service: "calculations",
      logger: createLogger(),
      generateUuid: () => "unused",
      now: () => new Date("2026-03-30T12:00:00.000Z"),
    });
    const command = new ArchiveCalculationCommand(runtime, commandUow as any);

    await expect(command.execute("calc-1")).resolves.toBe(true);
    expect(calculationStore.setActive).toHaveBeenCalledWith({
      calculationId: "calc-1",
      isActive: false,
    });
  });
});
