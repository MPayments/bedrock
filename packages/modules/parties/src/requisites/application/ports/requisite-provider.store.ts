import type { RequisiteProvider } from "../contracts/dto";

export type RequisiteProviderWriteInput = Omit<
  RequisiteProvider,
  "createdAt" | "updatedAt"
>;

export interface RequisiteProviderStore {
  findActiveById(id: string): Promise<RequisiteProvider | null>;
  create(provider: RequisiteProviderWriteInput): Promise<RequisiteProvider>;
  update(
    provider: RequisiteProviderWriteInput,
  ): Promise<RequisiteProvider | null>;
  archive(id: string, archivedAt: Date): Promise<boolean>;
}
