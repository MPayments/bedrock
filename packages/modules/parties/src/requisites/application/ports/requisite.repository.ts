import type { RequisiteOwnerType } from "../../domain/owner";
import type { Requisite } from "../../domain/requisite";
import type { RequisiteSet } from "../../domain/requisite-set";
import type { Requisite as RequisiteDetail } from "../contracts/requisites";

export interface RequisiteRepository {
  findDetailById(id: string): Promise<RequisiteDetail | null>;
  findById(id: string): Promise<Requisite | null>;
  findSetByOwnerCurrency(input: {
    ownerType: RequisiteOwnerType;
    ownerId: string;
    currencyId: string;
  }): Promise<RequisiteSet>;
  saveSet(set: RequisiteSet): Promise<void>;
  replaceIdentifiers(input: {
    requisiteId: string;
    items: {
      id?: string;
      scheme: string;
      value: string;
      isPrimary: boolean;
    }[];
  }): Promise<void>;
}
