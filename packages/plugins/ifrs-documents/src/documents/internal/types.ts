import type { DocumentModule } from "@bedrock/documents";

export interface OrganizationRequisiteBinding {
  requisiteId: string;
  bookId: string;
  organizationId: string;
  currencyCode: string;
  postingAccountNo: string;
  bookAccountInstanceId: string;
}

export interface RequisitesService {
  resolveBindings(input: {
    requisiteIds: string[];
  }): Promise<OrganizationRequisiteBinding[]>;
  findById(id: string): Promise<{
    id: string;
    ownerType: "organization" | "counterparty";
    ownerId: string;
  }>;
}

export interface IfrsModuleDeps {
  requisitesService: RequisitesService;
}

export type IfrsDocumentDb = Parameters<DocumentModule["canPost"]>[0]["db"];
