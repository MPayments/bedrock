import { describe, it, expect } from "vitest";
import { defineKeyspace, createKeyspaceRegistry } from "../src/keyspace";

describe("defineKeyspace", () => {
  it("builds namespaced keys and registry entries", () => {
    const keyspace = defineKeyspace("ledger", {
      account: (id: string) => `acct:${id}`,
    });

    expect(keyspace.namespace).toBe("ledger");
    expect(keyspace.keys.account("123")).toBe("ledger:acct:123");
    expect(keyspace.key("account", "123")).toBe("ledger:acct:123");

    const registry = createKeyspaceRegistry({ ledger: keyspace });
    expect(registry.ledger).toBe(keyspace);
  });
});
