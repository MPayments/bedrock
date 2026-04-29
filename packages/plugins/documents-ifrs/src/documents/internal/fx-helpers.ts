import {
  POSTING_TEMPLATE_KEY,
  type PostingTemplateKey,
} from "@bedrock/accounting/posting-contracts";
import {
  normalizeFinancialLine,
  type FinancialLine,
} from "@bedrock/documents/contracts";
import { DocumentValidationError } from "@bedrock/plugin-documents-sdk";
import type { Document } from "@bedrock/plugin-documents-sdk";
import {
  buildDocumentPostingRequest,
  serializeOccurredAt,
} from "@bedrock/plugin-documents-sdk/module-kit";
import { minorToAmountString, toMinorAmountString } from "@bedrock/shared/money";

import type {
  IfrsDocumentRuntime,
  IfrsModuleDeps,
  OrganizationRequisiteBinding,
  RequisitesService,
} from "./types";
import type {
  FxExecuteFinancialLineInput,
  FxExecuteFinancialLinePayload,
  FxExecuteInput,
  FxExecutePayload,
  FxExecuteQuoteSnapshot,
} from "../../validation";
import {
  compileFxExecuteManualFinancialLines,
  FxExecuteQuoteSnapshotSchema,
} from "../../validation";

const FX_EXECUTE_DOC_TYPES = ["fx_execute"] as const;

export async function resolveFxBindings(
  requisitesService: RequisitesService,
  input: {
    sourceRequisiteId: string;
    destinationRequisiteId: string;
  },
) {
  const [source, destination] = await requisitesService.resolveBindings({
    requisiteIds: [input.sourceRequisiteId, input.destinationRequisiteId],
  });

  if (!source || !destination) {
    throw new DocumentValidationError(
      "Organization requisite binding is missing",
    );
  }

  return { source, destination };
}

export function ensureFxBindingsMatchQuote(input: {
  source: OrganizationRequisiteBinding;
  destination: OrganizationRequisiteBinding;
  quoteSnapshot: FxExecuteQuoteSnapshot;
}) {
  ensureFxBindingsConvertible(input);

  if (input.quoteSnapshot.fromCurrency === input.quoteSnapshot.toCurrency) {
    throw new DocumentValidationError(
      "fx_execute quote snapshot must represent a currency conversion",
    );
  }

  if (input.source.currencyCode !== input.quoteSnapshot.fromCurrency) {
    throw new DocumentValidationError(
      `Currency mismatch: source=${input.source.currencyCode}, quote=${input.quoteSnapshot.fromCurrency}`,
    );
  }

  if (input.destination.currencyCode !== input.quoteSnapshot.toCurrency) {
    throw new DocumentValidationError(
      `Currency mismatch: destination=${input.destination.currencyCode}, quote=${input.quoteSnapshot.toCurrency}`,
    );
  }
}

export function ensureFxBindingsConvertible(input: {
  source: OrganizationRequisiteBinding;
  destination: OrganizationRequisiteBinding;
}) {
  if (input.source.requisiteId === input.destination.requisiteId) {
    throw new DocumentValidationError(
      "fx_execute requires different source and destination requisites",
    );
  }

  if (input.source.currencyCode === input.destination.currencyCode) {
    throw new DocumentValidationError(
      "fx_execute requires source and destination currencies to differ",
    );
  }
}

export async function loadFxQuoteSnapshot(
  deps: Pick<IfrsModuleDeps, "treasuryFxQuote">,
  input: {
    runtime: IfrsDocumentRuntime;
    fromCurrency: string;
    toCurrency: string;
    fromAmountMinor: string;
    asOf: Date;
    idempotencyKey: string;
  },
) {
  return FxExecuteQuoteSnapshotSchema.parse(
    await deps.treasuryFxQuote.createQuoteSnapshot(input),
  );
}

export async function revalidateFxQuoteSnapshot(
  deps: Pick<IfrsModuleDeps, "treasuryFxQuote">,
  runtime: IfrsDocumentRuntime,
  payload: FxExecutePayload,
) {
  const current = FxExecuteQuoteSnapshotSchema.parse(
    await deps.treasuryFxQuote.loadQuoteSnapshotById({
      runtime,
      quoteId: payload.quoteSnapshot.quoteId,
    }),
  );

  if (current.snapshotHash !== payload.quoteSnapshot.snapshotHash) {
    throw new DocumentValidationError(
      `Quote ${payload.quoteSnapshot.quoteId} changed after draft creation`,
    );
  }
}

export function normalizeFxExecuteAmount(input: {
  amount: string;
  sourceCurrency: string;
}) {
  const amountMinor = toMinorAmountString(input.amount, input.sourceCurrency, {
    requirePositive: true,
  });

  return {
    amountMinor,
    amount: minorToAmountString(BigInt(amountMinor), {
      currency: input.sourceCurrency,
    }),
  };
}

export function buildTreasuryFxQuoteIdempotencyKey(
  operationIdempotencyKey: string | null,
) {
  if (!operationIdempotencyKey) {
    throw new DocumentValidationError(
      "fx_execute requires an operation idempotency key for quote creation",
    );
  }

  return `documents.fx_execute.quote:${operationIdempotencyKey}`;
}

function toFinancialLine(line: {
  id: string;
  bucket: FxExecuteFinancialLinePayload["bucket"];
  currency: string;
  amountMinor: string;
  source: FxExecuteFinancialLinePayload["source"];
  settlementMode?: FxExecuteFinancialLinePayload["settlementMode"];
  memo?: string;
  metadata?: Record<string, string>;
}): FinancialLine {
  return normalizeFinancialLine({
    id: line.id,
    bucket: line.bucket,
    currency: line.currency,
    amountMinor: BigInt(line.amountMinor),
    source: line.source,
    settlementMode: line.settlementMode,
    memo: line.memo,
    metadata: line.metadata,
  });
}

function resolvePayloadCalcMethod(line: FxExecuteFinancialLinePayload) {
  if (line.source !== "manual") {
    return undefined;
  }

  return line.calcMethod === "percent" ? "percent" : "fixed";
}

function financialLinePayloadAggregateKey(line: FxExecuteFinancialLinePayload) {
  return [
    line.bucket,
    line.currency,
    line.source,
    line.settlementMode ?? "in_ledger",
    line.memo ?? "",
    resolvePayloadCalcMethod(line) ?? "",
  ].join("|");
}

function aggregateFxExecuteFinancialLinePayloads(
  lines: FxExecuteFinancialLinePayload[],
) {
  const grouped = new Map<string, FxExecuteFinancialLinePayload>();

  for (const line of lines) {
    const key = financialLinePayloadAggregateKey(line);
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, line);
      continue;
    }

    const amountMinor =
      BigInt(existing.amountMinor) + BigInt(line.amountMinor);
    if (amountMinor === 0n) {
      grouped.delete(key);
      continue;
    }

    const calcMethod = resolvePayloadCalcMethod(existing);
    grouped.set(key, {
      ...existing,
      amount: minorToAmountString(amountMinor, {
        currency: existing.currency,
      }),
      amountMinor: amountMinor.toString(),
      calcMethod,
      percentBps:
        calcMethod === "percent"
          ? (existing.percentBps ?? 0) + (line.percentBps ?? 0)
          : undefined,
      settlementMode: existing.settlementMode ?? "in_ledger",
      metadata: existing.metadata ?? line.metadata,
    });
  }

  return [...grouped.values()];
}

function mergeFxExecuteFinancialLines(input: {
  quoteSnapshot: FxExecuteQuoteSnapshot;
  manualFinancialLines: FxExecuteFinancialLineInput[];
}) {
  return aggregateFxExecuteFinancialLinePayloads([
    ...input.quoteSnapshot.financialLines,
    ...compileFxExecuteManualFinancialLines({
      financialLines: input.manualFinancialLines,
      amountMinor: input.quoteSnapshot.fromAmountMinor,
      currency: input.quoteSnapshot.fromCurrency,
    }),
  ]);
}

function isProviderExpenseBucket(bucket: FinancialLine["bucket"]) {
  return bucket === "provider_fee_expense" || bucket === "execution_expense";
}

export function normalizeFxExecutePayload(
  input: FxExecuteInput,
  bindings: {
    source: OrganizationRequisiteBinding;
    destination: OrganizationRequisiteBinding;
  },
  amount: {
    amount: string;
    amountMinor: string;
  },
  quoteSnapshot: FxExecuteQuoteSnapshot,
): FxExecutePayload {
  return {
    ...serializeOccurredAt(input),
    ownershipMode:
      bindings.source.organizationId === bindings.destination.organizationId
        ? "intra_org"
        : "cross_org",
    sourceOrganizationId: bindings.source.organizationId,
    sourceRequisiteId: input.sourceRequisiteId,
    destinationOrganizationId: bindings.destination.organizationId,
    destinationRequisiteId: input.destinationRequisiteId,
    amount: amount.amount,
    amountMinor: amount.amountMinor,
    quoteSnapshot,
    executionRef: input.executionRef,
    timeoutSeconds: input.timeoutSeconds,
    memo: input.memo,
    financialLines: mergeFxExecuteFinancialLines({
      quoteSnapshot,
      manualFinancialLines: input.financialLines,
    }),
  };
}

export async function markFxQuoteUsed(input: {
  deps: Pick<IfrsModuleDeps, "quoteUsage">;
  runtime: IfrsDocumentRuntime;
  quoteId: string;
  fxExecuteDocumentId: string;
  at: Date;
}) {
  await input.deps.quoteUsage.markQuoteUsedForFxExecute({
    runtime: input.runtime,
    quoteId: input.quoteId,
    fxExecuteDocumentId: input.fxExecuteDocumentId,
    at: input.at,
  });
}

export async function resolveFxExecuteDependencyDocument(
  deps: Pick<IfrsModuleDeps, "fxExecuteLookup">,
  runtime: IfrsDocumentRuntime,
  fxExecuteDocumentId: string,
) {
  const dependency = await deps.fxExecuteLookup.resolveFxExecuteDependencyDocument({
    runtime,
    fxExecuteDocumentId,
  });

  if (
    !FX_EXECUTE_DOC_TYPES.includes(
      dependency.docType as (typeof FX_EXECUTE_DOC_TYPES)[number],
    )
  ) {
    throw new DocumentValidationError(
      `FX execute document ${fxExecuteDocumentId} was not found`,
    );
  }

  return dependency;
}

export async function listPendingFxTransfers(
  deps: Pick<IfrsModuleDeps, "fxExecuteLookup">,
  runtime: IfrsDocumentRuntime,
  fxExecuteDocumentId: string,
) {
  const rows = await deps.fxExecuteLookup.listPendingTransfers({
    runtime,
    fxExecuteDocumentId,
  });

  if (rows.length === 0) {
    throw new DocumentValidationError(
      `FX execute document ${fxExecuteDocumentId} does not have pending transfers`,
    );
  }

  return rows;
}

function treasuryFxLineTemplate(line: FinancialLine): {
  templateKey: PostingTemplateKey;
  amountMinor: bigint;
} {
  if (isProviderExpenseBucket(line.bucket)) {
    return {
      templateKey:
        line.amountMinor > 0n
          ? POSTING_TEMPLATE_KEY.TREASURY_FX_PROVIDER_FEE_EXPENSE
          : POSTING_TEMPLATE_KEY.TREASURY_FX_PROVIDER_FEE_EXPENSE_REVERSAL,
      amountMinor: line.amountMinor > 0n ? line.amountMinor : -line.amountMinor,
    };
  }

  if (line.bucket === "pass_through") {
    return {
      templateKey:
        line.amountMinor > 0n
          ? POSTING_TEMPLATE_KEY.TREASURY_FX_PASS_THROUGH
          : POSTING_TEMPLATE_KEY.TREASURY_FX_PASS_THROUGH_REVERSAL,
      amountMinor: line.amountMinor > 0n ? line.amountMinor : -line.amountMinor,
    };
  }

  if (line.bucket === "adjustment") {
    return {
      templateKey:
        line.amountMinor > 0n
          ? POSTING_TEMPLATE_KEY.TREASURY_FX_ADJUSTMENT_CHARGE
          : POSTING_TEMPLATE_KEY.TREASURY_FX_ADJUSTMENT_REFUND,
      amountMinor: line.amountMinor > 0n ? line.amountMinor : -line.amountMinor,
    };
  }

  if (line.amountMinor > 0n) {
    return {
      templateKey:
        line.bucket === "spread_revenue"
          ? POSTING_TEMPLATE_KEY.TREASURY_FX_SPREAD_INCOME
          : POSTING_TEMPLATE_KEY.TREASURY_FX_FEE_INCOME,
      amountMinor: line.amountMinor,
    };
  }

  return {
    templateKey: POSTING_TEMPLATE_KEY.TREASURY_FX_ADJUSTMENT_REFUND,
    amountMinor: -line.amountMinor,
  };
}

export function buildTreasuryFxFinancialLineRequests(input: {
  document: Pick<Document, "id" | "occurredAt">;
  sourceBookId: string;
  sourceCurrency: string;
  destinationBookId: string;
  destinationCurrency: string;
  quoteId: string;
  chainId: string;
  executionRef?: string | null;
  fxExecuteDocumentId: string;
  baseDimensions: Record<string, string>;
  lines: FxExecutePayload["financialLines"];
}) {
  return input.lines.map((rawLine, index) => {
    const line = toFinancialLine(rawLine);
    const postingTemplate = treasuryFxLineTemplate(line);
    const bookId =
      line.currency === input.destinationCurrency
        ? input.destinationBookId
        : input.sourceBookId;

    return buildDocumentPostingRequest(input.document, {
      templateKey: postingTemplate.templateKey,
      bookId,
      currency: line.currency,
      amountMinor: postingTemplate.amountMinor,
      dimensions: {
        ...input.baseDimensions,
        feeBucket: line.bucket,
      },
      refs: {
        fxExecuteDocumentId: input.fxExecuteDocumentId,
        quoteId: input.quoteId,
        chainId: input.chainId,
        componentId: line.id,
        componentIndex: String(index + 1),
        ...(input.executionRef ? { executionRef: input.executionRef } : {}),
      },
      memo: line.memo ?? null,
    });
  });
}
