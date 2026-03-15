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
  externalRef?: string | null;
  displayName: string;
  description?: string | null;
}

export interface UpdateCustomerProps {
  externalRef?: string | null;
  displayName?: string;
  description?: string | null;
}

export class Customer extends Entity<string> {
  private constructor(private readonly snapshot: CustomerSnapshot) {
    super(snapshot.id);
  }

  static create(input: CreateCustomerProps, now: Date): Customer {
    return new Customer({
      id: input.id,
      externalRef: normalizeOptionalText(input.externalRef),
      displayName: normalizeRequiredText(
        input.displayName,
        "customer.display_name_required",
        "displayName",
      ),
      description: normalizeOptionalText(input.description),
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(snapshot: CustomerSnapshot): Customer {
    return new Customer({
      ...snapshot,
      externalRef: normalizeOptionalText(snapshot.externalRef),
      displayName: normalizeRequiredText(
        snapshot.displayName,
        "customer.display_name_required",
        "displayName",
      ),
      description: normalizeOptionalText(snapshot.description),
    });
  }

  update(input: UpdateCustomerProps, now: Date): Customer {
    return new Customer({
      ...this.snapshot,
      externalRef:
        input.externalRef !== undefined
          ? normalizeOptionalText(input.externalRef)
          : this.snapshot.externalRef,
      displayName:
        input.displayName !== undefined
          ? normalizeRequiredText(
              input.displayName,
              "customer.display_name_required",
              "displayName",
            )
          : this.snapshot.displayName,
      description:
        input.description !== undefined
          ? normalizeOptionalText(input.description)
          : this.snapshot.description,
      updatedAt: now,
    });
  }

  sameState(other: Customer): boolean {
    return this.snapshot.externalRef === other.snapshot.externalRef &&
      this.snapshot.displayName === other.snapshot.displayName &&
      this.snapshot.description === other.snapshot.description;
  }

  displayNameChangedComparedTo(other: Customer): boolean {
    return this.snapshot.displayName !== other.snapshot.displayName;
  }

  toSnapshot(): CustomerSnapshot {
    return { ...this.snapshot };
  }
}
