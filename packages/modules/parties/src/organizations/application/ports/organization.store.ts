import type { OrganizationListItem } from "../contracts/dto";

export type OrganizationAnchor = OrganizationListItem;
export type OrganizationWriteInput = Omit<
  OrganizationAnchor,
  "createdAt" | "updatedAt"
>;
export type OrganizationRemoveResult = "conflict" | "deleted" | "not_found";

export interface OrganizationStore {
  findById(id: string): Promise<OrganizationAnchor | null>;
  create(organization: OrganizationWriteInput): Promise<OrganizationAnchor>;
  update(
    organization: OrganizationWriteInput,
  ): Promise<OrganizationAnchor | null>;
  remove(id: string): Promise<OrganizationRemoveResult>;
}
