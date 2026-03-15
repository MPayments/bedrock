import { describe, expect, it } from "vitest";

import {
  AggregateRoot,
  brandId,
  DomainError,
  Entity,
  invariant,
  ValueObject,
} from "../../src/core/domain";

class EmailAddress extends ValueObject<{ value: string }> {
  static create(value: string): EmailAddress {
    return new EmailAddress({ value: value.trim().toLowerCase() });
  }

  get value(): string {
    return this.props.value;
  }
}

class Customer extends Entity<string> {
  static create(id: string): Customer {
    return new Customer(id);
  }
}

class CustomerAggregate extends AggregateRoot<string> {
  static create(id: string): CustomerAggregate {
    return new CustomerAggregate(id);
  }

  rename(name: string) {
    this.record({
      type: "customer.renamed",
      occurredAt: new Date("2026-01-01T00:00:00.000Z"),
      payload: { name },
    });
  }
}

describe("shared core domain primitives", () => {
  it("compares value objects by value", () => {
    expect(EmailAddress.create("USER@example.com").equals(
      EmailAddress.create("user@example.com"),
    )).toBe(true);
  });

  it("compares entities by id and type", () => {
    expect(Customer.create("cust-1").equals(Customer.create("cust-1"))).toBe(true);
    expect(Customer.create("cust-1").equals(Customer.create("cust-2"))).toBe(false);
  });

  it("brands ids and rejects empty values", () => {
    expect(brandId(" customer-1 ", "CustomerId")).toBe("customer-1");
    expect(() => brandId("   ", "CustomerId")).toThrow(DomainError);
  });

  it("throws domain errors for invariant violations", () => {
    expect(() =>
      invariant(false, "customer.invalid", "Customer is invalid"),
    ).toThrowError(
      expect.objectContaining({
        code: "customer.invalid",
        message: "Customer is invalid",
      }),
    );
  });

  it("records and drains aggregate events", () => {
    const aggregate = CustomerAggregate.create("cust-1");

    aggregate.rename("Acme");
    aggregate.rename("Acme 2");

    expect(aggregate.pullEvents()).toHaveLength(2);
    expect(aggregate.pullEvents()).toEqual([]);
  });
});
