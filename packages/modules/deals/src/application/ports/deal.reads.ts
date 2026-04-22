import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type {
  Deal,
  DealAttachmentIngestion,
  DealCalculationHistoryItem,
  DealDetails,
  DealFundingResolution,
  DealPricingContext,
  DealQuoteAcceptanceHistoryItem,
  DealTraceProjection,
  DealWorkflowProjection,
  PortalDealListProjection,
  PortalDealProjection,
} from "../contracts/dto";
import type { ListDealsQuery } from "../contracts/queries";

export interface DealFundingAssessmentPort {
  assessFunding(input: {
    acceptedQuoteId: string | null;
    hasConvertLeg: boolean;
    internalEntityOrganizationId: string | null;
    targetCurrencyId: string | null;
  }): Promise<DealFundingResolution>;
}

export interface DealReads {
  findById(id: string): Promise<DealDetails | null>;
  findAttachmentIngestionByFileAssetId(
    fileAssetId: string,
  ): Promise<DealAttachmentIngestion | null>;
  findPricingContextByDealId(dealId: string): Promise<DealPricingContext>;
  findPortalProjectionById(id: string): Promise<PortalDealProjection | null>;
  findTraceById(id: string): Promise<DealTraceProjection | null>;
  findWorkflowById(id: string): Promise<DealWorkflowProjection | null>;
  findWorkflowsByIds(ids: string[]): Promise<DealWorkflowProjection[]>;
  listAttachmentIngestionsByDealId(
    dealId: string,
  ): Promise<DealAttachmentIngestion[]>;
  list(input: ListDealsQuery): Promise<PaginatedList<Deal>>;
  listCalculationHistory(dealId: string): Promise<DealCalculationHistoryItem[]>;
  listQuoteAcceptances(
    dealId: string,
  ): Promise<DealQuoteAcceptanceHistoryItem[]>;
  listPortalDeals(input: {
    customerId: string;
    limit: number;
    offset: number;
  }): Promise<PortalDealListProjection>;
}
