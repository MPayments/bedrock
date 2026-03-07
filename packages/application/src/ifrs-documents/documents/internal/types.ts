import type { DocumentModule } from "@bedrock/core/documents";

export interface OrganizationRequisiteBinding {
  requisiteId: string;
  bookId: string;
  organizationId: string;
  currencyCode: string;
  postingAccountNo: string;
  bookAccountInstanceId: string;
}

export interface OrganizationRequisitesService {
  resolveBindings(input: {
    requisiteIds: string[];
  }): Promise<OrganizationRequisiteBinding[]>;
}

export interface IfrsModuleDeps {
  organizationRequisitesService: OrganizationRequisitesService;
}

export type IfrsDocumentDb = Parameters<DocumentModule["canPost"]>[0]["db"];
