import type { RequisiteOwnerType } from "../../domain/owner";
import type { Requisite } from "../../domain/requisite";
import type { RequisiteSet } from "../../domain/requisite-set";

export interface RequisiteRepository {
  findById(id: string): Promise<Requisite | null>;
  findSetByOwnerCurrency(input: {
    ownerType: RequisiteOwnerType;
    ownerId: string;
    currencyId: string;
  }): Promise<RequisiteSet>;
  saveSet(set: RequisiteSet): Promise<void>;
}
