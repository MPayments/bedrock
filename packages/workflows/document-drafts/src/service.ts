import type { AccountingPeriodsService } from "@bedrock/accounting";
import {
  DocumentValidationError,
  type DocumentsService,
} from "@bedrock/documents";
import type { Database, Transaction } from "@bedrock/platform/persistence";

export type CreateDocumentDraftService = (
  tx: Transaction,
) => Pick<DocumentsService, "createDraft">;

export interface DocumentDraftWorkflowDeps {
  db: Database;
  accountingPeriods: Pick<
    AccountingPeriodsService,
    "closePeriod" | "reopenPeriod"
  >;
  createDocumentsService: CreateDocumentDraftService;
}

function readDocumentPayloadString(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readDocumentPayloadDate(
  payload: Record<string, unknown>,
  key: string,
  fallback: Date,
): Date {
  const raw = payload[key];
  if (typeof raw === "string" || raw instanceof Date) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed;
    }
  }

  return fallback;
}

export function createDocumentDraftWorkflow(deps: DocumentDraftWorkflowDeps) {
  async function applyDraftPeriodMutation(input: {
    tx: Transaction;
    actorUserId: string;
    result: Awaited<
      ReturnType<
        ReturnType<DocumentDraftWorkflowDeps["createDocumentsService"]>["createDraft"]
      >
    >;
  }) {
    const payload = input.result.document.payload as Record<string, unknown>;

    if (input.result.document.docType === "period_close") {
      const organizationId = readDocumentPayloadString(
        payload,
        "organizationId",
      );
      if (!organizationId) {
        throw new DocumentValidationError(
          "period_close payload requires organizationId",
        );
      }

      await deps.accountingPeriods.closePeriod({
        organizationId,
        periodStart: readDocumentPayloadDate(
          payload,
          "periodStart",
          input.result.document.occurredAt,
        ),
        periodEnd: readDocumentPayloadDate(
          payload,
          "periodEnd",
          input.result.document.occurredAt,
        ),
        closedBy: input.actorUserId,
        closeReason: readDocumentPayloadString(payload, "closeReason"),
        closeDocumentId: input.result.document.id,
        db: input.tx,
      } as Parameters<AccountingPeriodsService["closePeriod"]>[0]);

      return;
    }

    if (input.result.document.docType !== "period_reopen") {
      return;
    }

    const organizationId = readDocumentPayloadString(payload, "organizationId");
    if (!organizationId) {
      throw new DocumentValidationError(
        "period_reopen payload requires organizationId",
      );
    }

    await deps.accountingPeriods.reopenPeriod({
      organizationId,
      periodStart: readDocumentPayloadDate(
        payload,
        "periodStart",
        input.result.document.occurredAt,
      ),
      reopenedBy: input.actorUserId,
      reopenReason: readDocumentPayloadString(payload, "reopenReason"),
      reopenDocumentId: input.result.document.id,
      db: input.tx,
    } as Parameters<AccountingPeriodsService["reopenPeriod"]>[0]);
  }

  return {
    async createDraft(
      input: Parameters<
        ReturnType<DocumentDraftWorkflowDeps["createDocumentsService"]>["createDraft"]
      >[0],
    ) {
      return deps.db.transaction(async (tx) => {
        const documents = deps.createDocumentsService(tx);
        const result = await documents.createDraft(input);

        await applyDraftPeriodMutation({
          tx,
          actorUserId: input.actorUserId,
          result,
        });

        return result;
      });
    },
  };
}

export type DocumentDraftWorkflow = ReturnType<
  typeof createDocumentDraftWorkflow
>;
