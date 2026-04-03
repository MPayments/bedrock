import type { PortalAccessGrantStore } from "./portal-access-grant.store";
import type { UnitOfWork } from "../../../shared/application/unit-of-work";

export interface PortalAccessGrantsTransaction {
  portalAccessGrantStore: PortalAccessGrantStore;
}

export type PortalAccessGrantsUnitOfWork = UnitOfWork<
  PortalAccessGrantsTransaction
>;
