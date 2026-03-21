import type { Organization } from "../contracts/dto";

export type OrganizationWriteInput = Omit<
  Organization,
  "createdAt" | "updatedAt"
>;
export type OrganizationRemoveResult = "conflict" | "deleted" | "not_found";

export interface OrganizationStore {
  findById(id: string): Promise<Organization | null>;
  create(organization: OrganizationWriteInput): Promise<Organization>;
  update(organization: OrganizationWriteInput): Promise<Organization | null>;
  remove(id: string): Promise<OrganizationRemoveResult>;
}
