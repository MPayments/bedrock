import { describe, it, expect, vi } from "vitest";

vi.mock("tigerbeetle-node", () => ({
  createClient: vi.fn(() => ({ mocked: true })),
  TransferFlags: { linked: 1, pending: 2, post_pending_transfer: 4, void_pending_transfer: 8 },
  AccountFlags: { debits_must_not_exceed_credits: 1, credits_must_not_exceed_debits: 2 },
  CreateAccountError: { exists: 1 },
  CreateTransferError: { exists: 1 },
}));

describe("createTbClient", () => {
  it("forwards cluster id and address to tigerbeetle client", async () => {
    const { createTbClient } = await import("@bedrock/ledger/infra/tigerbeetle");
    const { createClient } = await import("tigerbeetle-node");
    const client = createTbClient(10n, "127.0.0.1:3000");

    expect(createClient).toHaveBeenCalledWith({
      cluster_id: 10n,
      replica_addresses: ["127.0.0.1:3000"],
    });
    expect(client).toEqual({ mocked: true });
  });
});
