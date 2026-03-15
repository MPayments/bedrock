import { describe, expect, it } from "vitest";

import {
  CounterpartyCustomerNotFoundError,
  CounterpartyError,
  CounterpartyGroupNotFoundError,
  CounterpartyGroupRuleError,
  CounterpartyNotFoundError,
  CounterpartySystemGroupDeleteError,
  CustomerDeleteConflictError,
  CustomerError,
  CustomerNotFoundError,
  InternalLedgerInvariantViolationError,
} from "../../src/errors";

describe("parties errors", () => {
  it("constructs customer errors", () => {
    expect(new CustomerError("boom").message).toBe("boom");
    expect(new CustomerNotFoundError("cust-1").message).toContain("cust-1");
    expect(new CustomerDeleteConflictError("cust-1").message).toContain(
      "cust-1",
    );
  });

  it("constructs counterparty errors", () => {
    expect(new CounterpartyError("boom").message).toBe("boom");
    expect(new CounterpartyNotFoundError("cp-1").message).toContain("cp-1");
    expect(new CounterpartyGroupNotFoundError("grp-1").message).toContain(
      "grp-1",
    );
    expect(new CounterpartyGroupRuleError("bad rule").message).toBe("bad rule");
    expect(
      new CounterpartyCustomerNotFoundError("cust-1").message,
    ).toContain("cust-1");
    expect(
      new CounterpartySystemGroupDeleteError("grp-system").message,
    ).toContain("grp-system");
    expect(
      new InternalLedgerInvariantViolationError("broken invariant").message,
    ).toBe("broken invariant");
  });
});
