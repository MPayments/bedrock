import {
  buildDocNo,
  Document,
  type DocumentSnapshot,
  type DocumentApprovalStatus,
  type DocumentDraftMetadata,
} from "./document";
import { collectDocumentOrganizationIds } from "./document-period-scope";
import type { DocumentSummaryFields } from "./document-summary";

export interface DocumentDraftPlan {
  document: DocumentSnapshot;
  organizationIds: string[];
}

export interface BuildCreateDocumentDraftMetadataInput {
  id: string;
  docType: string;
  docNoPrefix: string;
  moduleId: string;
  moduleVersion: number;
  payloadVersion: number;
}

interface CreateDocumentDraftPlanInput {
  draft: DocumentDraftMetadata;
  payload: Record<string, unknown>;
  occurredAt: Date;
  createIdempotencyKey: string;
  createdBy: string;
  summary: DocumentSummaryFields;
  now: Date;
  approvalStatus: DocumentApprovalStatus;
  postingRequired: boolean;
}

interface UpdateDocumentDraftPlanInput {
  document: DocumentSnapshot;
  payload: Record<string, unknown>;
  occurredAt: Date;
  summary: DocumentSummaryFields;
  now: Date;
  approvalStatus: DocumentApprovalStatus;
}

export class DocumentDraftPlanner {
  buildCreateDraftMetadata(
    input: BuildCreateDocumentDraftMetadataInput,
  ): DocumentDraftMetadata {
    return {
      id: input.id,
      docNo: buildDocNo(input.docNoPrefix, input.id),
      docType: input.docType,
      moduleId: input.moduleId,
      moduleVersion: input.moduleVersion,
      payloadVersion: input.payloadVersion,
    };
  }

  buildUpdateDraftMetadata(
    document: Pick<
      DocumentSnapshot,
      | "id"
      | "docNo"
      | "docType"
      | "moduleId"
      | "moduleVersion"
      | "payloadVersion"
    >,
  ): DocumentDraftMetadata {
    return {
      id: document.id,
      docNo: document.docNo,
      docType: document.docType,
      moduleId: document.moduleId,
      moduleVersion: document.moduleVersion,
      payloadVersion: document.payloadVersion,
    };
  }

  buildCreatePreview(
    input: Omit<CreateDocumentDraftPlanInput, "approvalStatus">,
  ): DocumentDraftPlan {
    return this.buildCreatePlan({
      ...input,
      approvalStatus: "not_required",
    });
  }

  finalizeCreate(input: CreateDocumentDraftPlanInput): DocumentDraftPlan {
    return this.buildCreatePlan(input);
  }

  buildUpdatePreview(
    input: Omit<UpdateDocumentDraftPlanInput, "approvalStatus">,
  ): DocumentDraftPlan {
    return this.buildUpdatePlan({
      ...input,
      approvalStatus: "not_required",
    });
  }

  finalizeUpdate(input: UpdateDocumentDraftPlanInput): DocumentDraftPlan {
    return this.buildUpdatePlan(input);
  }

  private buildCreatePlan(
    input: CreateDocumentDraftPlanInput,
  ): DocumentDraftPlan {
    const postingStatus = input.postingRequired ? "unposted" : "not_required";
    const document = Document.createDraft({
      draft: input.draft,
      payload: input.payload,
      occurredAt: input.occurredAt,
      createIdempotencyKey: input.createIdempotencyKey,
      createdBy: input.createdBy,
      approvalStatus: input.approvalStatus,
      postingStatus,
      summary: input.summary,
      now: input.now,
    }).toSnapshot();

    return {
      document,
      organizationIds: collectDocumentOrganizationIds({
        payload: document.payload,
      }),
    };
  }

  private buildUpdatePlan(
    input: UpdateDocumentDraftPlanInput,
  ): DocumentDraftPlan {
    const document = Document.fromSnapshot(input.document)
      .updateDraft({
        payload: input.payload,
        occurredAt: input.occurredAt,
        approvalStatus: input.approvalStatus,
        summary: input.summary,
        now: input.now,
      })
      .toSnapshot();

    return {
      document,
      organizationIds: collectDocumentOrganizationIds({
        payload: document.payload,
      }),
    };
  }
}
