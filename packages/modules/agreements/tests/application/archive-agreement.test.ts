import { describe, expect, it, vi } from "vitest";

import { createModuleRuntime } from "@bedrock/shared/core";
import { createTestLogger } from "@bedrock/test-utils";

import { ArchiveAgreementCommand } from "../../src/application/commands/archive-agreement";

describe("archive agreement handler", () => {
  it("archives an agreement by toggling isActive to false", async () => {
    const agreementReads = {
      findById: vi.fn(async () => ({
        id: "agreement-1",
      })),
    };
    const agreementStore = {
      setActive: vi.fn(async () => undefined),
    };
    const tx = {
      agreementReads,
      agreementStore,
    };
    const commandUow = {
      run: vi.fn(async (work: (value: typeof tx) => Promise<unknown>) => work(tx)),
    };
    const runtime = createModuleRuntime({
      service: "agreements",
      logger: createTestLogger(),
      generateUuid: () => "unused",
      now: () => new Date("2026-03-30T12:00:00.000Z"),
    });
    const command = new ArchiveAgreementCommand(runtime, commandUow as any);

    await expect(command.execute("agreement-1")).resolves.toBe(true);
    expect(agreementStore.setActive).toHaveBeenCalledWith({
      agreementId: "agreement-1",
      isActive: false,
    });
  });
});
