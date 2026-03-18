import type {
  DocumentTransitionAction,
  DocumentTransitionInput,
} from "../../contracts/commands";
import type { Document } from "../../domain/document";
import type { DocumentModule, DocumentModuleContext } from "../../plugins";
import type { DocumentsAccountingPeriodsPort } from "../posting/ports";

export interface DocumentTransitionEffectsServices {
  accountingPeriods: DocumentsAccountingPeriodsPort;
}

export interface DocumentTransitionEffectsInput {
  action: Exclude<DocumentTransitionAction, "post" | "repost">;
  before: Document;
  after: Document;
  module: DocumentModule;
  moduleContext: DocumentModuleContext;
  services: DocumentTransitionEffectsServices;
  transition: DocumentTransitionInput;
  transaction?: unknown;
}

export interface DocumentTransitionEffectsService {
  apply(input: DocumentTransitionEffectsInput): Promise<void>;
}

function readPayloadString(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readPayloadDate(
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

function shouldApplyPeriodMutation(input: DocumentTransitionEffectsInput) {
  if (input.action === "approve") {
    return input.after.approvalStatus === "approved";
  }

  if (input.action === "submit") {
    return input.after.approvalStatus === "not_required";
  }

  return false;
}

export function createNoopDocumentTransitionEffectsService(): DocumentTransitionEffectsService {
  return {
    async apply() {},
  };
}

export function createAccountingPeriodDocumentTransitionEffectsService(): DocumentTransitionEffectsService {
  return {
    async apply(input) {
      if (
        input.after.docType === "period_close" &&
        shouldApplyPeriodMutation(input)
      ) {
        const payload = input.after.payload as Record<string, unknown>;
        const organizationId = readPayloadString(payload, "organizationId");
        if (!organizationId) {
          throw new Error("period_close payload requires organizationId");
        }

        await input.services.accountingPeriods.closePeriod({
          organizationId,
          periodStart: readPayloadDate(
            payload,
            "periodStart",
            input.after.occurredAt,
          ),
          periodEnd: readPayloadDate(
            payload,
            "periodEnd",
            input.after.occurredAt,
          ),
          closedBy: input.transition.actorUserId,
          closeReason: readPayloadString(payload, "closeReason"),
          closeDocumentId: input.after.id,
          db: input.transaction,
        });

        return;
      }

      if (
        input.after.docType === "period_reopen" &&
        shouldApplyPeriodMutation(input)
      ) {
        const payload = input.after.payload as Record<string, unknown>;
        const organizationId = readPayloadString(payload, "organizationId");
        if (!organizationId) {
          throw new Error("period_reopen payload requires organizationId");
        }

        await input.services.accountingPeriods.reopenPeriod({
          organizationId,
          periodStart: readPayloadDate(
            payload,
            "periodStart",
            input.after.occurredAt,
          ),
          reopenedBy: input.transition.actorUserId,
          reopenReason: readPayloadString(payload, "reopenReason"),
          reopenDocumentId: input.after.id,
          db: input.transaction,
        });
      }
    },
  };
}
