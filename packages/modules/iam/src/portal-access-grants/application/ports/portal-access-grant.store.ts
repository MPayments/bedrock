import type { PortalAccessGrant } from "../contracts/dto";

export interface PortalAccessGrantStore {
  consumeByUserId(userId: string): Promise<PortalAccessGrant | null>;
  revokeByUserId(userId: string): Promise<PortalAccessGrant | null>;
  upsert(input: {
    status: string;
    userId: string;
  }): Promise<PortalAccessGrant>;
}
