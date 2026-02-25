import { describe, expect, it } from "vitest";

import { transfersKeyspace } from "../src/keyspace";

describe("transfersKeyspace", () => {
  it("builds account keys in tr2 namespace", () => {
    expect(transfersKeyspace.namespace).toBe("tr2");
    expect(
      transfersKeyspace.keys.account("org-1", "bank-main", "USD"),
    ).toBe("tr2:Account:org-1:bank-main:USD");
    expect(
      transfersKeyspace.key("account", "org-2", "wallet", "EUR"),
    ).toBe("tr2:Account:org-2:wallet:EUR");
  });
});
