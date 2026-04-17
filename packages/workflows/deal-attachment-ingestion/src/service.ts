import { z } from "zod";

import type { CurrenciesService } from "@bedrock/currencies";
import {
  DealRevisionConflictError,
  type DealsModule,
} from "@bedrock/deals";
import type {
  DealAttachmentIngestionNormalizedPayload,
  DealBankInstructionSnapshot,
  DealCounterpartySnapshot,
  DealIntakeDraft,
  DealWorkflowProjection,
} from "@bedrock/deals/contracts";
import type { FilesModule } from "@bedrock/files";
import type {
  FileAttachment,
  FileAttachmentPurpose,
} from "@bedrock/files/contracts";
import type {
  DocumentExtractionPort,
} from "@bedrock/platform/ai";
import type { Logger } from "@bedrock/platform/observability/logger";
import { isDecimalString } from "@bedrock/shared/core";

const SUPPORTED_ATTACHMENT_PURPOSES = new Set<FileAttachmentPurpose>([
  "invoice",
  "contract",
]);

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const PAYMENT_DOCUMENT_EXTRACTION_INSTRUCTIONS = [
  "Extract structured payment document data for a commercial payment deal.",
  "Prefer exact values from the document and never invent missing fields.",
  "Return null for any field that is absent, ambiguous, or unreadable.",
  "Treat invoice and contract numbers as plain strings without reformatting.",
  "Normalize currency into an ISO currency code when it is explicit in the document.",
  "Extract beneficiary legal entity data separately from bank instruction data.",
  "Do not infer target currency or settlement destination from context.",
].join("\n");

const PaymentDocumentExtractionSchema = z.object({
  amount: z.string().nullable().default(null),
  bankInstruction: z
    .object({
      accountNo: z.string().nullable().default(null),
      bankAddress: z.string().nullable().default(null),
      bankCountry: z.string().nullable().default(null),
      bankName: z.string().nullable().default(null),
      beneficiaryName: z.string().nullable().default(null),
      bic: z.string().nullable().default(null),
      iban: z.string().nullable().default(null),
      label: z.string().nullable().default(null),
      swift: z.string().nullable().default(null),
    })
    .nullable()
    .default(null),
  beneficiary: z
    .object({
      country: z.string().nullable().default(null),
      displayName: z.string().nullable().default(null),
      inn: z.string().nullable().default(null),
      legalName: z.string().nullable().default(null),
    })
    .nullable()
    .default(null),
  contractNumber: z.string().nullable().default(null),
  currencyCode: z.string().nullable().default(null),
  documentPurpose: z.enum(["invoice", "contract", "other"]).nullable().default(null),
  invoiceNumber: z.string().nullable().default(null),
  paymentPurpose: z.string().nullable().default(null),
});

type PaymentDocumentExtraction = z.infer<typeof PaymentDocumentExtractionSchema>;

const SYSTEM_ACTOR_LABEL = "Автораспознавание документа";

type EligibleAttachmentPurpose = "invoice" | "contract";

type PaymentAttachmentMetadata = Pick<
  FileAttachment,
  "createdAt" | "fileName" | "id" | "mimeType" | "purpose" | "visibility"
>;

interface MergeResult {
  appliedFields: string[];
  changed: boolean;
  intake: DealIntakeDraft;
  skippedFields: string[];
}

export interface DealAttachmentIngestionWorkflowDeps {
  currencies: Pick<CurrenciesService, "findByCode">;
  deals: Pick<DealsModule, "deals">;
  documentExtraction?: DocumentExtractionPort;
  files: Pick<FilesModule, "files">;
  logger?: Logger;
}

interface RunOnceInput {
  batchSize?: number;
  leaseSeconds?: number;
  maxAttempts?: number;
  now?: Date;
  retryDelayMs?: number;
}

function normalizeNullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeCountry(value: string | null | undefined): string | null {
  const normalized = normalizeNullableText(value)?.toUpperCase() ?? null;
  return normalized;
}

function normalizeCurrencyCode(value: string | null | undefined): string | null {
  const normalized = normalizeNullableText(value)?.toUpperCase() ?? null;
  if (!normalized) {
    return null;
  }

  return /^[A-Z0-9]{3,16}$/u.test(normalized) ? normalized : null;
}

function normalizeDecimalString(value: string | null | undefined): string | null {
  const normalized = normalizeNullableText(value)
    ?.replace(/\s+/gu, "")
    .replace(/,/gu, ".")
    ?? null;

  if (!normalized) {
    return null;
  }

  return isDecimalString(normalized) ? normalized : null;
}

function isBlankText(value: string | null | undefined) {
  return normalizeNullableText(value) === null;
}

function hasCounterpartySnapshotValue(
  snapshot: DealCounterpartySnapshot | null | undefined,
) {
  return Boolean(
    snapshot &&
      [
        snapshot.country,
        snapshot.displayName,
        snapshot.inn,
        snapshot.legalName,
      ].some((value) => !isBlankText(value)),
  );
}

function hasBankInstructionSnapshotValue(
  snapshot: DealBankInstructionSnapshot | null | undefined,
) {
  return Boolean(
    snapshot &&
      [
        snapshot.accountNo,
        snapshot.bankAddress,
        snapshot.bankCountry,
        snapshot.bankName,
        snapshot.beneficiaryName,
        snapshot.bic,
        snapshot.iban,
        snapshot.label,
        snapshot.swift,
      ].some((value) => !isBlankText(value)),
  );
}

function emptyCounterpartySnapshot(): DealCounterpartySnapshot {
  return {
    country: null,
    displayName: null,
    inn: null,
    legalName: null,
  };
}

function emptyBankInstructionSnapshot(): DealBankInstructionSnapshot {
  return {
    accountNo: null,
    bankAddress: null,
    bankCountry: null,
    bankName: null,
    beneficiaryName: null,
    bic: null,
    iban: null,
    label: null,
    swift: null,
  };
}

function compactCounterpartySnapshot(
  snapshot: DealCounterpartySnapshot | null,
): DealCounterpartySnapshot | null {
  if (!snapshot || !hasCounterpartySnapshotValue(snapshot)) {
    return null;
  }

  return snapshot;
}

function compactBankInstructionSnapshot(
  snapshot: DealBankInstructionSnapshot | null,
): DealBankInstructionSnapshot | null {
  if (!snapshot || !hasBankInstructionSnapshotValue(snapshot)) {
    return null;
  }

  return snapshot;
}

function isEligibleAttachment(input: {
  attachment: PaymentAttachmentMetadata | null;
  workflow: DealWorkflowProjection;
}) {
  if (!input.attachment) {
    return false;
  }

  if (input.workflow.summary.type !== "payment") {
    return false;
  }

  if (
    !input.attachment.purpose ||
    !SUPPORTED_ATTACHMENT_PURPOSES.has(input.attachment.purpose)
  ) {
    return false;
  }

  return SUPPORTED_MIME_TYPES.has(input.attachment.mimeType);
}

async function resolveCurrencyId(
  deps: DealAttachmentIngestionWorkflowDeps,
  currencyCode: string | null,
) {
  if (!currencyCode) {
    return null;
  }

  try {
    const currency = await deps.currencies.findByCode(currencyCode);
    return currency.id;
  } catch {
    return null;
  }
}

async function normalizeExtractedPayload(input: {
  deps: DealAttachmentIngestionWorkflowDeps;
  extraction: PaymentDocumentExtraction;
  purpose: EligibleAttachmentPurpose;
}): Promise<DealAttachmentIngestionNormalizedPayload> {
  const beneficiarySnapshot = compactCounterpartySnapshot(
    input.extraction.beneficiary
      ? {
          country: normalizeCountry(input.extraction.beneficiary.country),
          displayName: normalizeNullableText(
            input.extraction.beneficiary.displayName,
          ),
          inn: normalizeNullableText(input.extraction.beneficiary.inn),
          legalName: normalizeNullableText(
            input.extraction.beneficiary.legalName,
          ),
        }
      : null,
  );
  const bankInstructionSnapshot = compactBankInstructionSnapshot(
    input.extraction.bankInstruction
      ? {
          accountNo: normalizeNullableText(
            input.extraction.bankInstruction.accountNo,
          ),
          bankAddress: normalizeNullableText(
            input.extraction.bankInstruction.bankAddress,
          ),
          bankCountry: normalizeCountry(
            input.extraction.bankInstruction.bankCountry,
          ),
          bankName: normalizeNullableText(
            input.extraction.bankInstruction.bankName,
          ),
          beneficiaryName: normalizeNullableText(
            input.extraction.bankInstruction.beneficiaryName,
          ),
          bic: normalizeNullableText(input.extraction.bankInstruction.bic),
          iban: normalizeNullableText(input.extraction.bankInstruction.iban),
          label: normalizeNullableText(input.extraction.bankInstruction.label),
          swift: normalizeNullableText(input.extraction.bankInstruction.swift),
        }
      : null,
  );
  const currencyCode = normalizeCurrencyCode(input.extraction.currencyCode);

  return {
    amount: normalizeDecimalString(input.extraction.amount),
    bankInstructionSnapshot,
    beneficiarySnapshot,
    contractNumber: normalizeNullableText(input.extraction.contractNumber),
    currencyCode,
    currencyId: await resolveCurrencyId(input.deps, currencyCode),
    documentPurpose: input.purpose,
    invoiceNumber: normalizeNullableText(input.extraction.invoiceNumber),
    paymentPurpose: normalizeNullableText(input.extraction.paymentPurpose),
  };
}

function applyTextField<
  T extends Record<string, unknown>,
  K extends keyof T,
>(input: {
  appliedFields: string[];
  nextValue: string | null;
  path: string;
  skippedFields: string[];
  target: T;
  targetKey: K;
}) {
  if (!input.nextValue) {
    return;
  }

  const currentValue = input.target[input.targetKey];

  if (
    currentValue === null ||
    currentValue === undefined ||
    (typeof currentValue === "string" && isBlankText(currentValue))
  ) {
    input.target[input.targetKey] = input.nextValue as T[K];
    input.appliedFields.push(input.path);
    return;
  }

  input.skippedFields.push(input.path);
}

function applyCurrencyField<
  T extends Record<string, unknown>,
  K extends keyof T,
>(input: {
  appliedFields: string[];
  nextValue: string | null;
  path: string;
  skippedFields: string[];
  target: T;
  targetKey: K;
}) {
  if (!input.nextValue) {
    return;
  }

  if (!input.target[input.targetKey]) {
    input.target[input.targetKey] = input.nextValue as T[K];
    input.appliedFields.push(input.path);
    return;
  }

  input.skippedFields.push(input.path);
}

function applyCounterpartySnapshot(
  current: DealCounterpartySnapshot | null,
  next: DealCounterpartySnapshot | null,
  path: string,
  appliedFields: string[],
  skippedFields: string[],
) {
  if (!next || !hasCounterpartySnapshotValue(next)) {
    return current;
  }

  const target = { ...(current ?? emptyCounterpartySnapshot()) };

  applyTextField({
    appliedFields,
    nextValue: next.displayName,
    path: `${path}.displayName`,
    skippedFields,
    target,
    targetKey: "displayName",
  });
  applyTextField({
    appliedFields,
    nextValue: next.legalName,
    path: `${path}.legalName`,
    skippedFields,
    target,
    targetKey: "legalName",
  });
  applyTextField({
    appliedFields,
    nextValue: next.inn,
    path: `${path}.inn`,
    skippedFields,
    target,
    targetKey: "inn",
  });
  applyTextField({
    appliedFields,
    nextValue: next.country,
    path: `${path}.country`,
    skippedFields,
    target,
    targetKey: "country",
  });

  return compactCounterpartySnapshot(target);
}

function applyBankInstructionSnapshot(
  current: DealBankInstructionSnapshot | null,
  next: DealBankInstructionSnapshot | null,
  path: string,
  appliedFields: string[],
  skippedFields: string[],
) {
  if (!next || !hasBankInstructionSnapshotValue(next)) {
    return current;
  }

  const target = { ...(current ?? emptyBankInstructionSnapshot()) };

  for (const key of [
    "beneficiaryName",
    "accountNo",
    "iban",
    "swift",
    "bic",
    "bankName",
    "bankCountry",
    "bankAddress",
    "label",
  ] as const) {
    applyTextField({
      appliedFields,
      nextValue: next[key],
      path: `${path}.${key}`,
      skippedFields,
      target,
      targetKey: key,
    });
  }

  return compactBankInstructionSnapshot(target);
}

export function mergeNormalizedPayloadIntoIntake(input: {
  intake: DealIntakeDraft;
  normalizedPayload: DealAttachmentIngestionNormalizedPayload;
  purpose: EligibleAttachmentPurpose;
}): MergeResult {
  const appliedFields: string[] = [];
  const skippedFields: string[] = [];
  const intake: DealIntakeDraft = {
    ...input.intake,
    common: { ...input.intake.common },
    externalBeneficiary: { ...input.intake.externalBeneficiary },
    incomingReceipt: { ...input.intake.incomingReceipt },
    moneyRequest: { ...input.intake.moneyRequest },
    settlementDestination: { ...input.intake.settlementDestination },
  };

  if (input.purpose === "invoice") {
    applyTextField({
      appliedFields,
      nextValue: input.normalizedPayload.invoiceNumber,
      path: "incomingReceipt.invoiceNumber",
      skippedFields,
      target: intake.incomingReceipt,
      targetKey: "invoiceNumber",
    });
    applyTextField({
      appliedFields,
      nextValue: input.normalizedPayload.amount,
      path: "incomingReceipt.expectedAmount",
      skippedFields,
      target: intake.incomingReceipt,
      targetKey: "expectedAmount",
    });
    applyCurrencyField({
      appliedFields,
      nextValue: input.normalizedPayload.currencyId,
      path: "incomingReceipt.expectedCurrencyId",
      skippedFields,
      target: intake.incomingReceipt,
      targetKey: "expectedCurrencyId",
    });
    applyCurrencyField({
      appliedFields,
      nextValue: input.normalizedPayload.currencyId,
      path: "moneyRequest.targetCurrencyId",
      skippedFields,
      target: intake.moneyRequest,
      targetKey: "targetCurrencyId",
    });
    applyTextField({
      appliedFields,
      nextValue: input.normalizedPayload.paymentPurpose,
      path: "moneyRequest.purpose",
      skippedFields,
      target: intake.moneyRequest,
      targetKey: "purpose",
    });
    intake.externalBeneficiary.beneficiarySnapshot = applyCounterpartySnapshot(
      intake.externalBeneficiary.beneficiarySnapshot,
      input.normalizedPayload.beneficiarySnapshot,
      "externalBeneficiary.beneficiarySnapshot",
      appliedFields,
      skippedFields,
    );
    intake.externalBeneficiary.bankInstructionSnapshot =
      applyBankInstructionSnapshot(
        intake.externalBeneficiary.bankInstructionSnapshot,
        input.normalizedPayload.bankInstructionSnapshot,
        "externalBeneficiary.bankInstructionSnapshot",
        appliedFields,
        skippedFields,
      );
  }

  if (input.purpose === "contract") {
    applyTextField({
      appliedFields,
      nextValue: input.normalizedPayload.contractNumber,
      path: "incomingReceipt.contractNumber",
      skippedFields,
      target: intake.incomingReceipt,
      targetKey: "contractNumber",
    });
  }

  return {
    appliedFields,
    changed: appliedFields.length > 0,
    intake,
    skippedFields,
  };
}

function buildRetryAt(now: Date, retryDelayMs: number) {
  return new Date(now.getTime() + retryDelayMs);
}

function createFailurePayload(input: {
  attachmentId: string;
  errorCode: string;
  errorMessage: string | null;
  purpose: FileAttachmentPurpose | null;
}) {
  return {
    attachmentId: input.attachmentId,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    purpose: input.purpose,
  };
}

function createSuccessPayload(input: {
  appliedFields: string[];
  attachmentId: string;
  purpose: FileAttachmentPurpose | null;
  skippedFields: string[];
}) {
  return {
    appliedFields: input.appliedFields,
    attachmentId: input.attachmentId,
    purpose: input.purpose,
    skippedFields: input.skippedFields,
  };
}

function classifyProcessingError(
  error: unknown,
): { code: string; message: string; retryable: boolean } {
  if (error instanceof DealRevisionConflictError) {
    return {
      code: "revision_conflict",
      message: error.message,
      retryable: true,
    };
  }

  if (error instanceof Error) {
    if (error.message.startsWith("Unsupported mime type")) {
      return {
        code: "unsupported_mime_type",
        message: error.message,
        retryable: false,
      };
    }
    if (error.message === "File storage is not configured") {
      return {
        code: "storage_unconfigured",
        message: error.message,
        retryable: false,
      };
    }

    return {
      code: "attachment_ingestion_failed",
      message: error.message,
      retryable: true,
    };
  }

  return {
    code: "attachment_ingestion_failed",
    message: "Unknown attachment ingestion error",
    retryable: true,
  };
}

async function findDealAttachment(
  deps: DealAttachmentIngestionWorkflowDeps,
  dealId: string,
  fileAssetId: string,
) {
  const attachments = await deps.files.files.queries.listDealAttachments(dealId);
  return (
    attachments.find((attachment) => attachment.id === fileAssetId) ?? null
  );
}

async function applyNormalizedPayload(input: {
  deps: DealAttachmentIngestionWorkflowDeps;
  normalizedPayload: DealAttachmentIngestionNormalizedPayload;
  purpose: EligibleAttachmentPurpose;
  workflow: DealWorkflowProjection;
}) {
  let workflow = input.workflow;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const merge = mergeNormalizedPayloadIntoIntake({
      intake: workflow.intake,
      normalizedPayload: input.normalizedPayload,
      purpose: input.purpose,
    });

    if (!merge.changed) {
      return {
        appliedFields: merge.appliedFields,
        appliedRevision: null,
        skippedFields: merge.skippedFields,
      };
    }

    try {
      const updated = await input.deps.deals.deals.commands.replaceIntake({
        actorLabel: SYSTEM_ACTOR_LABEL,
        actorUserId: null,
        dealId: workflow.summary.id,
        expectedRevision: workflow.revision,
        intake: merge.intake,
      });

      return {
        appliedFields: merge.appliedFields,
        appliedRevision: updated.revision,
        skippedFields: merge.skippedFields,
      };
    } catch (error) {
      if (!(error instanceof DealRevisionConflictError) || attempt > 0) {
        throw error;
      }

      const reloaded = await input.deps.deals.deals.queries.findWorkflowById(
        workflow.summary.id,
      );
      if (!reloaded) {
        throw error;
      }
      workflow = reloaded;
    }
  }

  throw new Error("Attachment ingestion retry exhausted");
}

async function processClaim(input: {
  claim: Awaited<
    ReturnType<
      DealsModule["deals"]["commands"]["claimAttachmentIngestions"]
    >
  >[number];
  deps: DealAttachmentIngestionWorkflowDeps;
}) {
  const workflow = await input.deps.deals.deals.queries.findWorkflowById(
    input.claim.dealId,
  );

  if (!workflow) {
    throw Object.assign(new Error("Deal not found"), {
      retryable: false,
      code: "deal_not_found",
    });
  }

  const attachment = await findDealAttachment(
    input.deps,
    input.claim.dealId,
    input.claim.fileAssetId,
  );

  if (!attachment) {
    throw Object.assign(new Error("Attachment not found"), {
      retryable: false,
      code: "attachment_not_found",
    });
  }

  if (!isEligibleAttachment({ attachment, workflow })) {
    throw Object.assign(new Error("Attachment is not eligible for ingestion"), {
      retryable: false,
      code: "attachment_ineligible",
    });
  }

  if (!input.deps.documentExtraction) {
    throw Object.assign(new Error("AI extraction is not configured"), {
      retryable: false,
      code: "extractor_unconfigured",
    });
  }

  const content = await input.deps.files.files.queries.getDealAttachmentContent({
    fileAssetId: input.claim.fileAssetId,
    ownerId: input.claim.dealId,
  });
  const purpose = attachment.purpose as EligibleAttachmentPurpose;
  const extracted = await input.deps.documentExtraction.extractFromBuffer(
    content.buffer,
    content.mimeType,
    PaymentDocumentExtractionSchema,
    {
      instructions: PAYMENT_DOCUMENT_EXTRACTION_INSTRUCTIONS,
    },
  );
  const normalizedPayload = await normalizeExtractedPayload({
    deps: input.deps,
    extraction: {
      ...extracted,
      documentPurpose: extracted.documentPurpose ?? purpose,
    },
    purpose,
  });
  const applied = await applyNormalizedPayload({
    deps: input.deps,
    normalizedPayload,
    purpose,
    workflow,
  });

  await input.deps.deals.deals.commands.completeAttachmentIngestion({
    appliedFields: applied.appliedFields,
    appliedRevision: applied.appliedRevision,
    dealId: input.claim.dealId,
    fileAssetId: input.claim.fileAssetId,
    normalizedPayload,
    skippedFields: applied.skippedFields,
  });
  await input.deps.deals.deals.commands.appendTimelineEvent({
    actorLabel: SYSTEM_ACTOR_LABEL,
    actorUserId: null,
    dealId: input.claim.dealId,
    payload: createSuccessPayload({
      appliedFields: applied.appliedFields,
      attachmentId: input.claim.fileAssetId,
      purpose,
      skippedFields: applied.skippedFields,
    }),
    sourceRef: `attachment:${input.claim.fileAssetId}:ingested`,
    type: "attachment_ingested",
    visibility: "internal",
  });
}

export function createDealAttachmentIngestionWorkflow(
  deps: DealAttachmentIngestionWorkflowDeps,
) {
  return {
    async enqueueIfEligible(input: { dealId: string; fileAssetId: string }) {
      const workflow = await deps.deals.deals.queries.findWorkflowById(input.dealId);
      if (!workflow) {
        return null;
      }

      const attachment = await findDealAttachment(
        deps,
        input.dealId,
        input.fileAssetId,
      );
      if (!isEligibleAttachment({ attachment, workflow })) {
        return null;
      }

      return deps.deals.deals.commands.enqueueAttachmentIngestion(input);
    },

    async reingest(input: { dealId: string; fileAssetId: string }) {
      const workflow = await deps.deals.deals.queries.findWorkflowById(input.dealId);
      const attachment = await findDealAttachment(
        deps,
        input.dealId,
        input.fileAssetId,
      );

      if (!workflow || !isEligibleAttachment({ attachment, workflow })) {
        throw new Error("Вложение нельзя отправить на повторное распознавание");
      }

      return deps.deals.deals.commands.enqueueAttachmentIngestion(input);
    },

    async runOnce(input: RunOnceInput = {}) {
      const claimed = await deps.deals.deals.commands.claimAttachmentIngestions({
        batchSize: input.batchSize ?? 25,
        leaseSeconds: input.leaseSeconds ?? 600,
      });

      let blocked = 0;
      let processed = 0;
      const now = input.now ?? new Date();
      const retryDelayMs = input.retryDelayMs ?? 60_000;
      const maxAttempts = input.maxAttempts ?? 3;

      for (const claim of claimed) {
        const attachment = await findDealAttachment(deps, claim.dealId, claim.fileAssetId);

        try {
          await processClaim({
            claim,
            deps,
          });
          processed += 1;
        } catch (error) {
          const base = classifyProcessingError(error);
          const code =
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            typeof error.code === "string"
              ? error.code
              : base.code;
          const retryable =
            typeof error === "object" &&
            error !== null &&
            "retryable" in error &&
            typeof error.retryable === "boolean"
              ? error.retryable
              : base.retryable;

          deps.logger?.error("Deal attachment ingestion failed", {
            attachmentId: claim.fileAssetId,
            dealId: claim.dealId,
            error: base.message,
            errorCode: code,
          });

          const shouldRetry = retryable && claim.attempts < maxAttempts;

          await deps.deals.deals.commands.failAttachmentIngestion({
            errorCode: code,
            errorMessage: base.message,
            fileAssetId: claim.fileAssetId,
            retryAt: shouldRetry ? buildRetryAt(now, retryDelayMs) : null,
          });

          if (!shouldRetry) {
            await deps.deals.deals.commands.appendTimelineEvent({
              actorLabel: SYSTEM_ACTOR_LABEL,
              actorUserId: null,
              dealId: claim.dealId,
              payload: createFailurePayload({
                attachmentId: claim.fileAssetId,
                errorCode: code,
                errorMessage: base.message,
                purpose: attachment?.purpose ?? null,
              }),
              sourceRef: `attachment:${claim.fileAssetId}:ingestion_failed`,
              type: "attachment_ingestion_failed",
              visibility: "internal",
            });
          }

          blocked += 1;
        }
      }

      return { blocked, processed };
    },
  };
}

export type DealAttachmentIngestionWorkflow = ReturnType<
  typeof createDealAttachmentIngestionWorkflow
>;
