import { describe, expect, it, vi } from "vitest";

import {
  bindPersistenceSession,
  createPersistenceContext,
  createTransactionalPort,
} from "@bedrock/platform/persistence";

describe("persistence context", () => {
  it("runs transactions via database context", async () => {
    const tx = { tag: "tx" };
    const db = {
      transaction: vi.fn(async (callback: (session: typeof tx) => Promise<string>) =>
        callback(tx)),
    };

    const persistence = createPersistenceContext(db as never);
    const result = await persistence.runInTransaction(async (session) => {
      expect(session).toBe(tx);
      return "ok";
    });

    expect(result).toBe("ok");
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });

  it("reuses the same bound session without nesting transactions", async () => {
    const tx = { tag: "tx" };
    const persistence = bindPersistenceSession(tx as never);

    const result = await persistence.runInTransaction(async (session) => {
      expect(session).toBe(tx);
      return "ok";
    });

    expect(result).toBe("ok");
  });

  it("creates transaction-scoped ports from the same binder", async () => {
    const tx = { tag: "tx" };
    const db = {
      transaction: vi.fn(async (callback: (session: typeof tx) => Promise<string>) =>
        callback(tx)),
    };
    const bind = vi.fn((queryable: { tag?: string }) => ({
      queryable,
    }));

    const transactional = createTransactionalPort(
      createPersistenceContext(db as never),
      bind as never,
    );

    const result = await transactional.withTransaction(async (port, session) => {
      expect(port).toEqual({
        queryable: tx,
      });
      expect(session).toBe(tx);
      return "ok";
    });

    expect(result).toBe("ok");
    expect(transactional.bind(tx as never)).toEqual({
      queryable: tx,
    });
    expect(bind).toHaveBeenNthCalledWith(1, tx);
    expect(bind).toHaveBeenNthCalledWith(2, tx);
  });
});
