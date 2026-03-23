import type { ModuleRuntime } from "@bedrock/shared/core";
import { InvalidStateError } from "@bedrock/shared/core/errors";

import type { PreparedDocumentPosting } from "./types";
import { Document } from "../../../documents/domain/document";
import { DocumentPostingNotRequiredError } from "../../../errors";
import type { DocumentTransitionInput } from "../../../lifecycle/application/contracts/commands";
import { invokeDocumentModuleAction } from "../../../lifecycle/application/shared/action-dispatch";
import { loadDocumentOrThrow } from "../../../lifecycle/application/shared/actions";
import { enforceDocumentPolicy } from "../../../lifecycle/application/shared/policy";
import type {
  DocumentActionPolicyService,
  DocumentRegistry,
} from "../../../plugins";
import {
  assertOrganizationPeriodsOpenForDocument,
  buildDocumentActionEvent,
  type DocumentActionEvent,
} from "../../../shared/application/action-runtime";
import { buildDocumentEventState } from "../../../shared/application/document-event-state";
import {
  createModuleContext,
  resolveDocumentAccountingSourceId,
  resolveModuleForDocument,
} from "../../../shared/application/module-resolution";
import type {
  DocumentsAccountingPeriodsPort,
  DocumentsAccountingPort,
  PostingCommandUnitOfWork,
} from "../ports";

export class PrepareDocumentPostCommand {
  constructor(
    private readonly runtime: ModuleRuntime,
    private readonly commandUow: PostingCommandUnitOfWork,
    private readonly accounting: DocumentsAccountingPort,
    private readonly accountingPeriods: DocumentsAccountingPeriodsPort,
    private readonly registry: DocumentRegistry,
    private readonly policy: DocumentActionPolicyService,
  ) {}

  async execute(
    input: DocumentTransitionInput,
  ): Promise<PreparedDocumentPosting> {
    return this.commandUow.run(
      async ({ documentsCommand, documentOperations, moduleRuntime }) => {
        const document = await loadDocumentOrThrow(documentsCommand, {
          documentId: input.documentId,
          docType: input.docType,
          forUpdate: true,
        });
        const module = resolveModuleForDocument(this.registry, document);
        const moduleContext = createModuleContext({
          actorUserId: input.actorUserId,
          now: this.runtime.now(),
          log: this.runtime.log,
          operationIdempotencyKey: null,
          runtime: moduleRuntime,
        });

        const successEvents: DocumentActionEvent[] = [];
        let postingDocument = document;
        const currentNow = this.runtime.now();
        const actorApprovalMode = await this.policy.approvalMode({
          module,
          document: postingDocument,
          actorUserId: input.actorUserId,
          moduleContext,
        });

        if (
          actorApprovalMode === "not_required" &&
          postingDocument.submissionStatus === "submitted" &&
          postingDocument.approvalStatus === "pending"
        ) {
          const beforeApprovalBypass = buildDocumentEventState(postingDocument);
          const bypassedApproval = {
            ...postingDocument,
            approvalStatus: "not_required" as const,
            updatedAt: currentNow,
          };
          const storedBypassedApproval = await documentsCommand.updateDocument({
            documentId: postingDocument.id,
            docType: input.docType,
            patch: {
              approvalStatus: bypassedApproval.approvalStatus,
              updatedAt: bypassedApproval.updatedAt,
            },
          });

          if (!storedBypassedApproval) {
            throw new InvalidStateError(
              "Failed to bypass document approval before posting",
            );
          }

          successEvents.push(
            buildDocumentActionEvent({
              eventType: "approval_bypassed",
              before: beforeApprovalBypass,
              after: buildDocumentEventState(storedBypassedApproval),
            }),
          );

          postingDocument = storedBypassedApproval;
        }

        if (
          module.allowDirectPostFromDraft &&
          postingDocument.submissionStatus === "draft"
        ) {
          await invokeDocumentModuleAction({
            action: "submit",
            module,
            moduleContext,
            document: postingDocument,
          });
          await enforceDocumentPolicy({
            policy: this.policy,
            action: "submit",
            module,
            actorUserId: input.actorUserId,
            moduleContext,
            document: postingDocument,
            requestContext: input.requestContext,
          });

          const beforeSubmit = buildDocumentEventState(postingDocument);
          const submitted = Document.fromSnapshot(postingDocument)
            .submit({
              actorUserId: input.actorUserId,
              now: currentNow,
              module: {
                postingRequired: module.postingRequired,
                allowDirectPostFromDraft: false,
              },
            })
            .toSnapshot();

          const storedSubmitted = await documentsCommand.updateDocument({
            documentId: postingDocument.id,
            docType: input.docType,
            patch: {
              submissionStatus: submitted.submissionStatus,
              submittedBy: submitted.submittedBy,
              submittedAt: submitted.submittedAt,
              updatedAt: submitted.updatedAt,
            },
          });

          if (!storedSubmitted) {
            throw new InvalidStateError(
              "Failed to submit document before posting",
            );
          }

          successEvents.push(
            buildDocumentActionEvent({
              eventType: "submit",
              before: beforeSubmit,
              after: buildDocumentEventState(storedSubmitted),
            }),
          );

          postingDocument = storedSubmitted;
        }

        const startedPosting = Document.fromSnapshot(postingDocument)
          .startPosting({
            actorUserId: input.actorUserId,
            now: currentNow,
            module: {
              postingRequired: module.postingRequired,
              allowDirectPostFromDraft: false,
            },
          })
          .document.toSnapshot();

        if (!module.buildPostingPlan) {
          throw new DocumentPostingNotRequiredError(
            document.id,
            document.docType,
          );
        }

        const existingOperationId =
          await documentOperations.findPostingOperationId({
            documentId: postingDocument.id,
          });
        if (existingOperationId) {
          throw new InvalidStateError("Document already has a posting operation");
        }

        await assertOrganizationPeriodsOpenForDocument({
          accountingPeriods: this.accountingPeriods,
          document: postingDocument,
          docType: input.docType,
        });

        await invokeDocumentModuleAction({
          action: "post",
          module,
          moduleContext,
          document: postingDocument,
        });
        await enforceDocumentPolicy({
          policy: this.policy,
          action: "post",
          module,
          actorUserId: input.actorUserId,
          moduleContext,
          document: postingDocument,
          requestContext: input.requestContext,
        });

        const postingPlan = await module.buildPostingPlan(
          moduleContext,
          postingDocument,
        );

        const accountingSourceId = await resolveDocumentAccountingSourceId({
          module,
          moduleContext,
          document: postingDocument,
          postingPlan,
        });

        const resolved = await this.accounting.resolvePostingPlan({
          accountingSourceId,
          source: {
            type: `documents/${postingDocument.docType}/post`,
            id: postingDocument.id,
          },
          idempotencyKey: module.buildPostIdempotencyKey(postingDocument),
          postingDate: postingDocument.occurredAt,
          bookIdContext: postingPlan.requests[0]?.bookRefs.bookId,
          plan: postingPlan,
        });

        const beforePost = buildDocumentEventState(postingDocument);

        const stored = await documentsCommand.updateDocument({
          documentId: postingDocument.id,
          docType: input.docType,
          patch: {
            postingStatus: startedPosting.postingStatus,
            postingStartedAt: startedPosting.postingStartedAt,
            postingError: startedPosting.postingError,
            updatedAt: startedPosting.updatedAt,
          },
        });

        if (!stored) {
          throw new InvalidStateError("Failed to mark document as posting");
        }

        return {
          action: "post",
          docType: input.docType,
          document: stored,
          actorUserId: input.actorUserId,
          requestContext: input.requestContext,
          postingOperationId: null,
          successEvents,
          finalEvent: {
            eventType: "post",
            before: beforePost,
            after: buildDocumentEventState(stored),
            reasonMeta: {
              packChecksum: resolved.packChecksum,
              postingPlanChecksum: resolved.postingPlanChecksum,
              journalIntentChecksum: resolved.journalIntentChecksum,
              postingPlan,
              journalIntent: resolved.intent,
              resolvedTemplates: resolved.appliedTemplates,
            },
          },
          resolved,
        };
      },
    );
  }
}
