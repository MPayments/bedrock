import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type {
  Deal,
  DealAttachmentIngestion,
  DealCalculationHistoryItem,
  DealDetails,
  DealFundingResolution,
  DealRouteTemplate,
  DealRouteTemplateSummary,
  DealRouteVersion,
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
  findPortalProjectionById(id: string): Promise<PortalDealProjection | null>;
  findCurrentRouteByDealId(id: string): Promise<DealRouteVersion | null>;
  findRouteTemplateById(id: string): Promise<DealRouteTemplate | null>;
  findTraceById(id: string): Promise<DealTraceProjection | null>;
  findWorkflowById(id: string): Promise<DealWorkflowProjection | null>;
  findWorkflowsByIds(ids: string[]): Promise<DealWorkflowProjection[]>;
  listAttachmentIngestionsByDealId(
    dealId: string,
  ): Promise<DealAttachmentIngestion[]>;
  list(input: ListDealsQuery): Promise<PaginatedList<Deal>>;
  listRouteTemplates(input?: {
    dealType?: Deal["type"];
    status?: ("draft" | "published" | "archived")[];
  }): Promise<DealRouteTemplateSummary[]>;
  listCalculationHistory(dealId: string): Promise<DealCalculationHistoryItem[]>;
  listPortalDeals(input: {
    customerId: string;
    limit: number;
    offset: number;
  }): Promise<PortalDealListProjection>;
}
