import { describe, expect, it } from "vitest";

import {
  CounterpartyCustomerNotFoundError,
  CounterpartyError,
  CounterpartyGroupNotFoundError,
  CounterpartyGroupRuleError,
  CounterpartyNotInternalLedgerEntityError,
  CounterpartyNotFoundError,
  CounterpartySystemGroupDeleteError,
  InternalLedgerInvariantViolationError,
} from "../../src/counterparties/errors";

describe("counterparties errors", () => {
  it("constructs CounterpartyError", () => {
    const error = new CounterpartyError("boom");
    expect(error.message).toBe("boom");
  });

  it("constructs CounterpartyNotFoundError", () => {
    const error = new CounterpartyNotFoundError("cp-1");
    expect(error.name).toBe("CounterpartyNotFoundError");
    expect(error.message).toContain("Counterparty not found: cp-1");
  });

  it("constructs CounterpartyGroupNotFoundError", () => {
    const error = new CounterpartyGroupNotFoundError("grp-1");
    expect(error.name).toBe("CounterpartyGroupNotFoundError");
    expect(error.message).toContain("Counterparty group not found: grp-1");
  });

  it("constructs CounterpartyGroupRuleError", () => {
    const error = new CounterpartyGroupRuleError("invalid group rule");
    expect(error.name).toBe("CounterpartyGroupRuleError");
    expect(error.message).toBe("invalid group rule");
  });

  it("constructs CounterpartyCustomerNotFoundError", () => {
    const error = new CounterpartyCustomerNotFoundError("cust-1");
    expect(error.name).toBe("CounterpartyCustomerNotFoundError");
    expect(error.message).toContain("Customer not found: cust-1");
  });

  it("constructs CounterpartySystemGroupDeleteError", () => {
    const error = new CounterpartySystemGroupDeleteError("grp-system");
    expect(error.name).toBe("CounterpartySystemGroupDeleteError");
    expect(error.message).toContain(
      "System counterparty group cannot be deleted: grp-system",
    );
  });

  it("constructs CounterpartyNotInternalLedgerEntityError", () => {
    const error = new CounterpartyNotInternalLedgerEntityError("cp-1");
    expect(error.name).toBe("CounterpartyNotInternalLedgerEntityError");
    expect(error.message).toContain(
      "Counterparty is not an internal ledger entity: cp-1",
    );
  });

  it("constructs InternalLedgerInvariantViolationError", () => {
    const error = new InternalLedgerInvariantViolationError("broken invariant");
    expect(error.name).toBe("InternalLedgerInvariantViolationError");
    expect(error.message).toBe("broken invariant");
  });
});
