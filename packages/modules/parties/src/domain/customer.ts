import {
  Entity,
  normalizeOptionalText,
  normalizeRequiredText,
} from "@bedrock/shared/core/domain";

export interface CustomerSnapshot {
  id: string;
  externalRef: string | null;
  displayName: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomerProps {
  id: string;
  externalRef: string | null;
  displayName: string;
  description: string | null;
}

export interface UpdateCustomerProps {
  externalRef: string | null;
  displayName: string;
  description: string | null;
}

function normalizeCustomerSnapshot(
  snapshot: CustomerSnapshot,
): CustomerSnapshot {
  return {
    ...snapshot,
    externalRef: normalizeOptionalText(snapshot.externalRef),
    displayName: normalizeRequiredText(
      snapshot.displayName,
      "customer.display_name_required",
      "displayName",
    ),
    description: normalizeOptionalText(snapshot.description),
  };
}

export class Customer extends Entity<string> {
  private readonly snapshot: CustomerSnapshot;

  private constructor(snapshot: CustomerSnapshot) {
    super(snapshot.id);
    this.snapshot = normalizeCustomerSnapshot(snapshot);
  }

  static create(input: CreateCustomerProps, now: Date): Customer {
    return new Customer({
      id: input.id,
      externalRef: input.externalRef,
      displayName: input.displayName,
      description: input.description,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(snapshot: CustomerSnapshot): Customer {
    return new Customer({ ...snapshot });
  }

  update(input: UpdateCustomerProps, now: Date): Customer {
    return new Customer({
      ...this.snapshot,
      ...input,
      updatedAt: now,
    });
  }

  sameState(other: Customer): boolean {
    return (
      this.snapshot.externalRef === other.snapshot.externalRef &&
      this.snapshot.displayName === other.snapshot.displayName &&
      this.snapshot.description === other.snapshot.description
    );
  }

  displayNameChangedComparedTo(other: Customer): boolean {
    return this.snapshot.displayName !== other.snapshot.displayName;
  }

  toSnapshot(): CustomerSnapshot {
    return { ...this.snapshot };
  }
}
