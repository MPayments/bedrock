import { describe, it, expect } from "vitest";
import { transfersKeyspace } from "../src/keyspace";

describe("transfersKeyspace", () => {
  it("builds namespaced transfer keys", () => {
    expect(transfersKeyspace.namespace).toBe("tr");
    expect(transfersKeyspace.keys.customerWallet("cust-1", "USD")).toBe("tr:CustomerWallet:cust-1:USD");
    expect(transfersKeyspace.keys.internal("org-1", "ops", "EUR")).toBe("tr:Internal:org-1:ops:EUR");
    expect(transfersKeyspace.key("customerWallet", "cust-2", "GBP")).toBe("tr:CustomerWallet:cust-2:GBP");
  });
});
