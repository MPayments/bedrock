import type {
  PaymentRouteCalculation,
  PaymentRouteTemplate,
  PaymentRouteTemplateListItem,
} from "../contracts/dto";
import type { ListPaymentRouteTemplatesQuery } from "../contracts/queries";
import type {
  PaymentRouteDraft,
  PaymentRouteTemplateStatus,
  PaymentRouteVisualMetadata,
} from "../contracts/zod";

export interface PaymentRouteTemplateRecord {
  createdAt: Date;
  draft: PaymentRouteDraft;
  id: string;
  lastCalculation: PaymentRouteCalculation | null;
  name: string;
  snapshotPolicy: "clone_on_attach";
  status: PaymentRouteTemplateStatus;
  updatedAt: Date;
  visual: PaymentRouteVisualMetadata;
}

export interface PaymentRouteTemplateWriteModel {
  createdAt: Date;
  draft: PaymentRouteDraft;
  id: string;
  lastCalculation: PaymentRouteCalculation | null;
  name: string;
  snapshotPolicy: "clone_on_attach";
  status: PaymentRouteTemplateStatus;
  updatedAt: Date;
  visual: PaymentRouteVisualMetadata;
}

export interface PaymentRouteTemplatesRepository {
  insertTemplate(
    input: PaymentRouteTemplateWriteModel,
  ): Promise<PaymentRouteTemplateRecord>;
  updateTemplate(
    id: string,
    input: Partial<
      Pick<
        PaymentRouteTemplateWriteModel,
        "draft" | "lastCalculation" | "name" | "status" | "updatedAt" | "visual"
      >
    >,
  ): Promise<PaymentRouteTemplateRecord | null>;
  findTemplateById(id: string): Promise<PaymentRouteTemplateRecord | null>;
  listTemplates(
    input: ListPaymentRouteTemplatesQuery,
  ): Promise<{ rows: PaymentRouteTemplateRecord[]; total: number }>;
}

export function mapPaymentRouteTemplateRecord(
  record: PaymentRouteTemplateRecord,
): PaymentRouteTemplate {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function mapPaymentRouteTemplateListItem(
  record: PaymentRouteTemplateRecord,
): PaymentRouteTemplateListItem {
  const sourceParticipant = record.draft.participants[0]!;
  const destinationParticipant =
    record.draft.participants[record.draft.participants.length - 1]!;

  return {
    createdAt: record.createdAt.toISOString(),
    currencyInId: record.draft.currencyInId,
    currencyOutId: record.draft.currencyOutId,
    destinationParticipant,
    hopCount: Math.max(record.draft.participants.length - 2, 0),
    id: record.id,
    lastCalculation: record.lastCalculation,
    name: record.name,
    snapshotPolicy: record.snapshotPolicy,
    sourceParticipant,
    status: record.status,
    updatedAt: record.updatedAt.toISOString(),
  };
}
