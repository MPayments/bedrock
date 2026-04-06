import type {
  RequisiteProvider,
  RequisiteProviderListItem,
} from "../contracts/dto";

export type RequisiteProviderWriteInput = Omit<
  RequisiteProviderListItem,
  "createdAt" | "updatedAt"
>;

export interface RequisiteProviderStore {
  findDetailById(id: string): Promise<RequisiteProvider | null>;
  findActiveById(id: string): Promise<RequisiteProviderListItem | null>;
  create(
    provider: RequisiteProviderWriteInput,
  ): Promise<RequisiteProviderListItem>;
  update(
    provider: RequisiteProviderWriteInput,
  ): Promise<RequisiteProviderListItem | null>;
  replaceIdentifiers(input: {
    providerId: string;
    items: {
      id?: string;
      scheme: string;
      value: string;
      isPrimary: boolean;
    }[];
  }): Promise<void>;
  replaceBranches(input: {
    providerId: string;
    items: {
      id?: string;
      code: string | null;
      name: string;
      country: string | null;
      jurisdictionCode: string | null;
      postalCode: string | null;
      city: string | null;
      line1: string | null;
      line2: string | null;
      rawAddress: string | null;
      contactEmail: string | null;
      contactPhone: string | null;
      isPrimary: boolean;
      identifiers: {
        id?: string;
        scheme: string;
        value: string;
        isPrimary: boolean;
      }[];
    }[];
  }): Promise<void>;
  archive(id: string, archivedAt: Date): Promise<boolean>;
}
