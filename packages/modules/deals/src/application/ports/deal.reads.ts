import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type {
  Deal,
  DealCapabilityState,
  DealCalculationHistoryItem,
  DealDetails,
  DealTraceProjection,
  DealWorkflowProjection,
  PortalDealListProjection,
  PortalDealProjection,
} from "../contracts/dto";
import type { ListDealsQuery } from "../contracts/queries";

export interface DealReads {
  findById(id: string): Promise<DealDetails | null>;
  findPortalProjectionById(id: string): Promise<PortalDealProjection | null>;
  findTraceById(id: string): Promise<DealTraceProjection | null>;
  findWorkflowById(id: string): Promise<DealWorkflowProjection | null>;
  listCapabilityStates(input: {
    applicantCounterpartyId?: string;
    capabilityKind?: DealCapabilityState["kind"];
    dealType?: DealCapabilityState["dealType"];
    internalEntityOrganizationId?: string;
    status?: DealCapabilityState["status"];
  }): Promise<DealCapabilityState[]>;
  list(input: ListDealsQuery): Promise<PaginatedList<Deal>>;
  listCalculationHistory(dealId: string): Promise<DealCalculationHistoryItem[]>;
  listPortalDeals(input: {
    customerId: string;
    limit: number;
    offset: number;
  }): Promise<PortalDealListProjection>;
}
