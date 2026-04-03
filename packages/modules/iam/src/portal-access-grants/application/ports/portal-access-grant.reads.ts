import type { PortalAccessGrant } from "../contracts/dto";

export interface PortalAccessGrantReads {
  findByUserId(userId: string): Promise<PortalAccessGrant | null>;
  hasPendingGrant(userId: string): Promise<boolean>;
}
