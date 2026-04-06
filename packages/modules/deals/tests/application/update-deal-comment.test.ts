import { describe, expect, it, vi } from "vitest";

import { UpdateDealCommentCommand } from "../../src/application/commands/update-deal-comment";

function createHarness() {
  const existing = {
    amount: "100.00",
    agreementId: "agreement-1",
    agentId: null,
    approvals: [],
    calculationId: null,
    comment: "Old comment",
    createdAt: new Date("2026-03-30T12:00:00.000Z"),
    currencyId: "currency-1",
    customerId: "customer-1",
    id: "00000000-0000-4000-8000-000000000010",
    intakeComment: "Intake comment",
    legs: [],
    nextAction: "Complete intake",
    participants: [],
    reason: null,
    revision: 1,
    status: "draft" as const,
    statusHistory: [],
    type: "payment" as const,
    updatedAt: new Date("2026-03-30T12:00:00.000Z"),
  };
  const updated = {
    ...existing,
    comment: "New comment",
  };
  const dealReads = {
    findById: vi
      .fn()
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(updated),
  };
  const dealStore = {
    setDealRoot: vi.fn(),
  };
  const tx = {
    transaction: { id: "tx-1" } as any,
    dealReads,
    dealStore,
  };
  const commandUow = {
    run: vi.fn(async (work: (value: typeof tx) => Promise<unknown>) => work(tx)),
  };
  const command = new UpdateDealCommentCommand(commandUow as any);

  return {
    commandUow,
    dealReads,
    dealStore,
    handler: command.execute.bind(command),
    updated,
  };
}

describe("update deal comment command", () => {
  it("updates the root deal comment without touching intake", async () => {
    const harness = createHarness();

    const result = await harness.handler({
      comment: "  New comment  ",
      dealId: "00000000-0000-4000-8000-000000000010",
    });

    expect(result).toEqual(harness.updated);
    expect(harness.commandUow.run).toHaveBeenCalledTimes(1);
    expect(harness.dealStore.setDealRoot).toHaveBeenCalledWith({
      comment: "New comment",
      dealId: "00000000-0000-4000-8000-000000000010",
    });
  });
});
