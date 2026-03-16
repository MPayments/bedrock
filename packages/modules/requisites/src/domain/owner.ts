export const REQUISITE_OWNER_TYPE_VALUES = [
  "organization",
  "counterparty",
] as const;

export type RequisiteOwnerType = (typeof REQUISITE_OWNER_TYPE_VALUES)[number];

export interface RequisiteOwnerSnapshot {
  type: RequisiteOwnerType;
  id: string;
}

export class RequisiteOwner {
  private constructor(private readonly snapshot: RequisiteOwnerSnapshot) {}

  static create(input: RequisiteOwnerSnapshot): RequisiteOwner {
    return new RequisiteOwner({ ...input });
  }

  static organization(id: string): RequisiteOwner {
    return new RequisiteOwner({ type: "organization", id });
  }

  static counterparty(id: string): RequisiteOwner {
    return new RequisiteOwner({ type: "counterparty", id });
  }

  get type(): RequisiteOwnerType {
    return this.snapshot.type;
  }

  get id(): string {
    return this.snapshot.id;
  }

  isOrganization(): boolean {
    return this.snapshot.type === "organization";
  }

  isCounterparty(): boolean {
    return this.snapshot.type === "counterparty";
  }

  toSnapshot(): RequisiteOwnerSnapshot {
    return { ...this.snapshot };
  }
}
