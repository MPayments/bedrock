import type {
  PaymentRouteCalculation,
  PaymentRouteTemplate,
  PaymentRouteTemplateListItem,
} from "../contracts/dto";
import { PaymentRouteCalculationSchema } from "../contracts/dto";
import type { ListPaymentRouteTemplatesQuery } from "../contracts/queries";
import type {
  PaymentRouteDraft,
  PaymentRouteTemplateStatus,
  PaymentRouteVisualMetadata,
} from "../contracts/zod";
import {
  PaymentRouteDraftSchema,
  normalizePaymentRouteDraft,
} from "../contracts/zod";

export interface PaymentRouteTemplateRecord {
  createdAt: Date;
  draft: PaymentRouteDraft;
  id: string;
  lastCalculation: PaymentRouteCalculation | null;
  maxMarginBps: number | null;
  minMarginBps: number | null;
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
  maxMarginBps: number | null;
  minMarginBps: number | null;
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
        | "draft"
        | "lastCalculation"
        | "maxMarginBps"
        | "minMarginBps"
        | "name"
        | "status"
        | "updatedAt"
        | "visual"
      >
    >,
  ): Promise<PaymentRouteTemplateRecord | null>;
  findTemplateById(id: string): Promise<PaymentRouteTemplateRecord | null>;
  listTemplates(
    input: ListPaymentRouteTemplatesQuery,
  ): Promise<{ rows: PaymentRouteTemplateRecord[]; total: number }>;
}

function normalizeRecordDraft(
  draft: PaymentRouteTemplateRecord["draft"],
): PaymentRouteDraft {
  return PaymentRouteDraftSchema.parse(normalizePaymentRouteDraft(draft));
}

function normalizeRecordCalculation(
  calculation: PaymentRouteTemplateRecord["lastCalculation"],
): PaymentRouteCalculation | null {
  if (!calculation) {
    return null;
  }

  const parsed = PaymentRouteCalculationSchema.safeParse(calculation);

  return parsed.success ? parsed.data : null;
}

export function mapPaymentRouteTemplateRecord(
  record: PaymentRouteTemplateRecord,
): PaymentRouteTemplate {
  const draft = normalizeRecordDraft(record.draft);
  const lastCalculation = normalizeRecordCalculation(record.lastCalculation);

  return {
    ...record,
    draft,
    lastCalculation,
    maxMarginBps: record.maxMarginBps,
    minMarginBps: record.minMarginBps,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function mapPaymentRouteTemplateListItem(
  record: PaymentRouteTemplateRecord,
): PaymentRouteTemplateListItem {
  const draft = normalizeRecordDraft(record.draft);
  const lastCalculation = normalizeRecordCalculation(record.lastCalculation);
  const sourceEndpoint = draft.participants[0]!;
  const destinationEndpoint = draft.participants[draft.participants.length - 1]!;

  return {
    createdAt: record.createdAt.toISOString(),
    currencyInId: draft.currencyInId,
    currencyOutId: draft.currencyOutId,
    destinationEndpoint,
    hopCount: Math.max(draft.participants.length - 2, 0),
    id: record.id,
    lastCalculation,
    name: record.name,
    snapshotPolicy: record.snapshotPolicy,
    sourceEndpoint,
    status: record.status,
    updatedAt: record.updatedAt.toISOString(),
  };
}
