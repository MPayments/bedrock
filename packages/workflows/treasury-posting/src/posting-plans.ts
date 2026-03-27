import type {
  DocumentPostingPlan,
  DocumentPostingPlanRequest,
} from "@bedrock/accounting/contracts";
import {
  ACCOUNTING_SOURCE_ID,
  OPERATION_CODE,
  POSTING_TEMPLATE_KEY,
} from "@bedrock/accounting/posting-contracts";
import type {
  ExecutionEvent,
  RecordExecutionEventInput,
} from "@bedrock/treasury/executions";
import type { Obligation } from "@bedrock/treasury/obligations";
import type {
  OperationTimelineItem,
  TreasuryOperation,
} from "@bedrock/treasury/operations";
import type { TreasuryPosition } from "@bedrock/treasury/positions";
import { InvalidStateError } from "@bedrock/shared/core/errors";

type JsonRecord = Record<string, unknown>;

export interface TreasuryPostingPlanInput {
  accountingSourceId: string;
  source: {
    type: string;
    id: string;
  };
  idempotencyKey: string;
  postingDate: Date;
  bookId: string;
  plan: DocumentPostingPlan;
}

type ExecutionInstructionRead = {
  id: string;
  operationId: string;
  sourceAccountId: string;
  destinationEndpointId: string | null;
  assetId: string;
  amountMinor: bigint;
  metadata: JsonRecord | null;
};

type TreasuryAccountRead = {
  id: string;
  ownerEntityId: string;
} | null;

function buildPlan(input: {
  operationCode: string;
  payload: Record<string, unknown>;
  request: DocumentPostingPlanRequest;
}): DocumentPostingPlan {
  return {
    operationCode: input.operationCode,
    operationVersion: 1,
    payload: input.payload,
    requests: [input.request],
  };
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asPositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  return null;
}

function asPositiveBigInt(value: unknown): bigint | null {
  if (typeof value === "bigint" && value > 0n) {
    return value;
  }

  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return BigInt(value);
  }

  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) {
    return BigInt(value);
  }

  return null;
}

function asSignedBigInt(value: unknown): bigint | null {
  if (typeof value === "bigint" && value !== 0n) {
    return value;
  }

  if (typeof value === "number" && Number.isInteger(value) && value !== 0) {
    return BigInt(value);
  }

  if (typeof value === "string" && /^-?[1-9]\d*$/.test(value)) {
    return BigInt(value);
  }

  return null;
}

function mergeMetadata(...values: (JsonRecord | null | undefined)[]): JsonRecord {
  return values.reduce<JsonRecord>((acc, value) => {
    if (!value) {
      return acc;
    }

    return {
      ...acc,
      ...value,
    };
  }, {});
}

function resolveExecutionEventSource(eventKind: ExecutionEvent["eventKind"]) {
  switch (eventKind) {
    case "submitted":
      return {
        accountingSourceId: ACCOUNTING_SOURCE_ID.TREASURY_EXECUTION_SUBMITTED,
        operationCode: OPERATION_CODE.TREASURY_EXECUTION_SUBMITTED,
      };
    case "settled":
      return {
        accountingSourceId: ACCOUNTING_SOURCE_ID.TREASURY_EXECUTION_SETTLED,
        operationCode: OPERATION_CODE.TREASURY_EXECUTION_SETTLED,
      };
    case "failed":
      return {
        accountingSourceId: ACCOUNTING_SOURCE_ID.TREASURY_EXECUTION_FAILED,
        operationCode: OPERATION_CODE.TREASURY_EXECUTION_FAILED,
      };
    case "returned":
      return {
        accountingSourceId: ACCOUNTING_SOURCE_ID.TREASURY_EXECUTION_RETURNED,
        operationCode: OPERATION_CODE.TREASURY_EXECUTION_RETURNED,
      };
    case "voided":
      return {
        accountingSourceId: ACCOUNTING_SOURCE_ID.TREASURY_EXECUTION_VOIDED,
        operationCode: OPERATION_CODE.TREASURY_EXECUTION_VOIDED,
      };
    default:
      return null;
  }
}

function resolvePositionTemplate(input: {
  kind: TreasuryPosition["positionKind"];
  action: "open" | "settle";
}) {
  if (input.kind === "customer_liability") {
    return input.action === "open"
      ? POSTING_TEMPLATE_KEY.TREASURY_POSITION_CUSTOMER_LIABILITY_OPEN
      : POSTING_TEMPLATE_KEY.TREASURY_POSITION_CUSTOMER_LIABILITY_SETTLE;
  }

  if (input.kind === "intercompany_due_from") {
    return input.action === "open"
      ? POSTING_TEMPLATE_KEY.TREASURY_POSITION_INTERCOMPANY_DUE_FROM_OPEN
      : POSTING_TEMPLATE_KEY.TREASURY_POSITION_INTERCOMPANY_DUE_FROM_SETTLE;
  }

  if (input.kind === "intercompany_due_to") {
    return input.action === "open"
      ? POSTING_TEMPLATE_KEY.TREASURY_POSITION_INTERCOMPANY_DUE_TO_OPEN
      : POSTING_TEMPLATE_KEY.TREASURY_POSITION_INTERCOMPANY_DUE_TO_SETTLE;
  }

  return null;
}

const FX_FINANCIAL_LINE_BUCKETS = [
  "fee_revenue",
  "spread_revenue",
  "provider_fee_expense",
  "pass_through",
  "adjustment",
] as const;

type FxFinancialLineBucket = (typeof FX_FINANCIAL_LINE_BUCKETS)[number];

type FxFinancialLine = {
  id: string;
  bucket: FxFinancialLineBucket;
  currency: string;
  amountMinor: bigint;
  memo: string | null;
};

function isFxFinancialLineBucket(value: unknown): value is FxFinancialLineBucket {
  return (
    typeof value === "string" &&
    FX_FINANCIAL_LINE_BUCKETS.includes(value as FxFinancialLineBucket)
  );
}

function parseFxFinancialLines(value: unknown): FxFinancialLine[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const line = item as JsonRecord;
    if (line.settlementMode === "separate_payment_order") {
      return [];
    }

    const bucket = isFxFinancialLineBucket(line.bucket) ? line.bucket : null;
    const amountMinor = asSignedBigInt(line.amountMinor);
    const currency = asString(line.currency);
    const id = asString(line.id) ?? `fx-line-${index + 1}`;

    if (!bucket || !amountMinor || !currency) {
      return [];
    }

    return [
      {
        id,
        bucket,
        currency,
        amountMinor,
        memo: typeof line.memo === "string" ? line.memo : null,
      },
    ];
  });
}

function resolveTreasuryFxFinancialLineTemplate(line: FxFinancialLine): {
  templateKey: DocumentPostingPlanRequest["templateKey"];
  amountMinor: bigint;
} {
  if (line.bucket === "provider_fee_expense") {
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

export function buildObligationOpenPostingPlan(input: {
  obligation: Obligation;
  currency: string;
  bookId: string;
}): TreasuryPostingPlanInput[] {
  if (
    input.obligation.obligationKind !== "ap_invoice" &&
    input.obligation.obligationKind !== "ar_invoice"
  ) {
    return [];
  }

  const templateKey =
    input.obligation.obligationKind === "ap_invoice"
      ? POSTING_TEMPLATE_KEY.COMMERCIAL_INCOMING_INVOICE_OPEN
      : POSTING_TEMPLATE_KEY.COMMERCIAL_OUTGOING_INVOICE_OPEN;
  const counterpartyId =
    input.obligation.obligationKind === "ap_invoice"
      ? input.obligation.creditorEntityId
      : input.obligation.debtorEntityId;

  return [
    {
      accountingSourceId: ACCOUNTING_SOURCE_ID.TREASURY_OBLIGATION_OPENED,
      source: {
        type: "treasury/obligations/open",
        id: input.obligation.id,
      },
      idempotencyKey: `treasury:obligation-open:${input.obligation.id}`,
      postingDate: input.obligation.createdAt,
      bookId: input.bookId,
      plan: buildPlan({
        operationCode: OPERATION_CODE.TREASURY_OBLIGATION_OPENED,
        payload: {
          obligationId: input.obligation.id,
          obligationKind: input.obligation.obligationKind,
        },
        request: {
          templateKey,
          effectiveAt: input.obligation.createdAt,
          currency: input.currency,
          amountMinor: BigInt(input.obligation.amountMinor),
          bookRefs: {
            bookId: input.bookId,
          },
          dimensions: {
            orderId: input.obligation.id,
            counterpartyId,
          },
          memo: input.obligation.memo ?? null,
        },
      }),
    },
  ];
}

export function buildExecutionEventPostingPlans(input: {
  event: ExecutionEvent;
  operation: TreasuryOperation;
  instruction: ExecutionInstructionRead;
  previousEventKinds: string[];
  timeline: OperationTimelineItem;
  sourceAccount: TreasuryAccountRead;
  destinationAccount: TreasuryAccountRead;
  sourceCurrency: string | null;
  destinationCurrency: string | null;
  sourceBookId: string | null;
  destinationBookId: string | null;
  recordInput: RecordExecutionEventInput;
}): TreasuryPostingPlanInput[] {
  const resolvedEventSource = resolveExecutionEventSource(input.event.eventKind);
  if (!resolvedEventSource) {
    return [];
  }
  const source = resolvedEventSource;

  if (
    input.event.eventKind === "accepted" ||
    input.event.eventKind === "fee_charged" ||
    input.event.eventKind === "manual_adjustment"
  ) {
    return [];
  }

  const sourceRef = {
    type: `treasury/execution-events/${input.event.eventKind}`,
    id: input.event.id,
  };
  const metadata = mergeMetadata(
    input.instruction.metadata,
    input.recordInput.metadata ?? null,
    input.event.metadata ?? null,
  );
  const sourcePendingId = asPositiveBigInt(metadata.sourcePendingId) ??
    asPositiveBigInt(metadata.pendingId);
  const destinationPendingId =
    asPositiveBigInt(metadata.destinationPendingId) ??
    asPositiveBigInt(metadata.pendingId);
  const sourcePendingRef =
    asString(metadata.sourcePendingRef) ??
    asString(metadata.pendingRef) ??
    `treasury:instruction:${input.instruction.id}:source`;
  const destinationPendingRef =
    asString(metadata.destinationPendingRef) ??
    asString(metadata.pendingRef) ??
    `treasury:instruction:${input.instruction.id}:destination`;
  const timeoutSeconds = asPositiveInt(metadata.timeoutSeconds) ?? 86_400;
  const hasOpenPending =
    input.previousEventKinds.some(
      (eventKind) => eventKind === "submitted" || eventKind === "accepted",
    ) &&
    !input.previousEventKinds.some((eventKind) =>
      eventKind === "settled" ||
      eventKind === "failed" ||
      eventKind === "returned" ||
      eventKind === "voided"
    );
  const hadSettled = input.previousEventKinds.some(
    (eventKind) => eventKind === "settled",
  );
  const eventPayload = {
    eventId: input.event.id,
    instructionId: input.instruction.id,
    operationId: input.operation.id,
    operationKind: input.operation.operationKind,
  };

  function buildEventPlanItem(inputPlan: {
    bookId: string;
    request: DocumentPostingPlanRequest;
    idempotencySuffix?: string;
  }): TreasuryPostingPlanInput {
    return {
      accountingSourceId: source.accountingSourceId,
      source: sourceRef,
      idempotencyKey: inputPlan.idempotencySuffix
        ? `treasury:execution-event:${input.event.id}:${inputPlan.idempotencySuffix}`
        : `treasury:execution-event:${input.event.id}`,
      postingDate: input.event.eventAt,
      bookId: inputPlan.bookId,
      plan: buildPlan({
        operationCode: source.operationCode,
        payload: eventPayload,
        request: inputPlan.request,
      }),
    };
  }

  function buildRequestBase(inputBase: {
    templateKey: DocumentPostingPlanRequest["templateKey"];
    currency: string;
    amountMinor: bigint;
    bookId: string;
    dimensions: Record<string, string>;
    refs?: Record<string, string> | null;
    pending?: DocumentPostingPlanRequest["pending"];
    memo?: string | null;
  }): DocumentPostingPlanRequest {
    return {
      templateKey: inputBase.templateKey,
      effectiveAt: input.event.eventAt,
      currency: inputBase.currency,
      amountMinor: inputBase.amountMinor,
      bookRefs: {
        bookId: inputBase.bookId,
      },
      dimensions: inputBase.dimensions,
      refs: inputBase.refs ?? undefined,
      pending: inputBase.pending ?? undefined,
      memo: inputBase.memo ?? input.operation.memo ?? null,
    };
  }

  const orderId = input.timeline.obligations[0] ?? input.operation.id;
  const eventIdempotencyKey = `treasury:execution-event:${input.event.id}`;

  if (input.operation.operationKind === "collection") {
    const sourceAmountMinor = asPositiveBigInt(input.operation.sourceAmountMinor);
    if (
      !input.sourceBookId ||
      !input.sourceCurrency ||
      !input.sourceAccount ||
      !sourceAmountMinor
    ) {
      return [];
    }

    if (input.event.eventKind === "submitted") {
      return [
        buildEventPlanItem({
          bookId: input.sourceBookId,
          request: buildRequestBase({
            templateKey: POSTING_TEMPLATE_KEY.TREASURY_CASH_IN_PENDING,
            currency: input.sourceCurrency,
            amountMinor: sourceAmountMinor,
            bookId: input.sourceBookId,
            dimensions: {
              orderId: input.operation.id,
              organizationRequisiteId: input.sourceAccount.id,
            },
            pending: {
              ref: sourcePendingRef,
              timeoutSeconds,
            },
          }),
        }),
      ];
    }

    if (input.event.eventKind === "settled") {
      const request = hasOpenPending
        ? buildRequestBase({
            templateKey: POSTING_TEMPLATE_KEY.TREASURY_CASH_PENDING_SETTLE,
            currency: input.sourceCurrency,
            amountMinor: sourceAmountMinor,
            bookId: input.sourceBookId,
            dimensions: {},
            refs: {
              orderId: input.operation.id,
              eventIdempotencyKey,
              pendingSide: "source",
            },
            pending: {
              pendingId:
                sourcePendingId ??
                (() => {
                  throw new InvalidStateError(
                    "pendingId is required to settle a submitted collection event",
                  );
                })(),
              ref: sourcePendingRef,
              amountMinor: sourceAmountMinor,
            },
          })
        : buildRequestBase({
            templateKey: POSTING_TEMPLATE_KEY.TREASURY_CASH_IN_IMMEDIATE,
            currency: input.sourceCurrency,
            amountMinor: sourceAmountMinor,
            bookId: input.sourceBookId,
            dimensions: {
              orderId: input.operation.id,
              organizationRequisiteId: input.sourceAccount.id,
            },
          });

      return [
        buildEventPlanItem({
          bookId: input.sourceBookId,
          request,
        }),
      ];
    }

    if (input.event.eventKind === "returned" && hadSettled) {
      return [
        buildEventPlanItem({
          bookId: input.sourceBookId,
          request: buildRequestBase({
            templateKey: POSTING_TEMPLATE_KEY.TREASURY_CASH_OUT_IMMEDIATE,
            currency: input.sourceCurrency,
            amountMinor: sourceAmountMinor,
            bookId: input.sourceBookId,
            dimensions: {
              orderId: input.operation.id,
              organizationRequisiteId: input.sourceAccount.id,
            },
          }),
        }),
      ];
    }

    if (!hasOpenPending) {
      return [];
    }

    return [
      buildEventPlanItem({
        bookId: input.sourceBookId,
        request: buildRequestBase({
          templateKey: POSTING_TEMPLATE_KEY.TREASURY_CASH_PENDING_VOID,
          currency: input.sourceCurrency,
          amountMinor: sourceAmountMinor,
          bookId: input.sourceBookId,
          dimensions: {},
          refs: {
            orderId: input.operation.id,
            eventIdempotencyKey,
            pendingSide: "source",
          },
          pending: {
            pendingId:
              sourcePendingId ??
              (() => {
                throw new InvalidStateError(
                  "pendingId is required to reverse a submitted collection event",
                );
              })(),
            ref: sourcePendingRef,
            amountMinor: 0n,
          },
        }),
      }),
    ];
  }

  if (input.operation.operationKind === "payout") {
    if (!input.sourceCurrency || !input.sourceBookId) {
      return [];
    }

    const organizationRequisiteId =
      asString(metadata.organizationRequisiteId) ?? input.instruction.sourceAccountId;
    const railRef = asString(metadata.railRef) ?? input.event.id;
    const payoutBankStableKey =
      asString(metadata.payoutBankStableKey) ??
      input.instruction.destinationEndpointId ??
      input.instruction.id;

    if (input.event.eventKind === "submitted") {
      return [
        buildEventPlanItem({
          bookId: input.sourceBookId,
          request: buildRequestBase({
            templateKey: POSTING_TEMPLATE_KEY.PAYMENT_PAYOUT_INITIATE,
            currency: input.sourceCurrency,
            amountMinor: input.instruction.amountMinor,
            bookId: input.sourceBookId,
            dimensions: {
              orderId,
              organizationRequisiteId,
            },
            refs: {
              railRef,
              payoutBankStableKey,
            },
            pending: {
              ref: sourcePendingRef,
              timeoutSeconds,
            },
          }),
        }),
      ];
    }

    if (input.event.eventKind === "settled") {
      const request = hasOpenPending
        ? buildRequestBase({
            templateKey: POSTING_TEMPLATE_KEY.PAYMENT_PAYOUT_SETTLE,
            currency: input.sourceCurrency,
            amountMinor: input.instruction.amountMinor,
            bookId: input.sourceBookId,
            dimensions: {},
            refs: {
              orderId,
              railRef,
            },
            pending: {
              pendingId:
                sourcePendingId ??
                (() => {
                  throw new InvalidStateError(
                    "pendingId is required to settle a submitted execution event",
                  );
                })(),
              ref: sourcePendingRef,
              amountMinor: input.instruction.amountMinor,
            },
          })
        : buildRequestBase({
            templateKey: POSTING_TEMPLATE_KEY.PAYMENT_PAYOUT_IMMEDIATE,
            currency: input.sourceCurrency,
            amountMinor: input.instruction.amountMinor,
            bookId: input.sourceBookId,
            dimensions: {
              orderId,
              organizationRequisiteId,
            },
            refs: {
              railRef,
              payoutBankStableKey,
            },
          });

      return [
        buildEventPlanItem({
          bookId: input.sourceBookId,
          request,
        }),
      ];
    }

    if (!hasOpenPending) {
      return [];
    }

    return [
      buildEventPlanItem({
        bookId: input.sourceBookId,
        request: buildRequestBase({
          templateKey: POSTING_TEMPLATE_KEY.PAYMENT_PAYOUT_VOID,
          currency: input.sourceCurrency,
          amountMinor: input.instruction.amountMinor,
          bookId: input.sourceBookId,
          dimensions: {},
          refs: {
            orderId,
            railRef,
          },
          pending: {
            pendingId:
              sourcePendingId ??
              (() => {
                throw new InvalidStateError(
                  "pendingId is required to reverse a submitted execution event",
                );
              })(),
            ref: sourcePendingRef,
            amountMinor: 0n,
          },
        }),
      }),
    ];
  }

  if (
    input.operation.operationKind === "intracompany_transfer" ||
    input.operation.operationKind === "sweep"
  ) {
    const sourceAmountMinor = asPositiveBigInt(input.operation.sourceAmountMinor);
    if (
      !input.sourceBookId ||
      !input.sourceCurrency ||
      !input.operation.sourceAccountId ||
      !input.operation.destinationAccountId ||
      !sourceAmountMinor
    ) {
      return [];
    }

    if (input.event.eventKind === "submitted") {
      return [
        buildEventPlanItem({
          bookId: input.sourceBookId,
          request: buildRequestBase({
            templateKey: POSTING_TEMPLATE_KEY.TRANSFER_INTRA_PENDING,
            currency: input.sourceCurrency,
            amountMinor: sourceAmountMinor,
            bookId: input.sourceBookId,
            dimensions: {
              sourceRequisiteId: input.operation.sourceAccountId,
              destinationRequisiteId: input.operation.destinationAccountId,
            },
            pending: {
              ref: sourcePendingRef,
              timeoutSeconds,
            },
          }),
        }),
      ];
    }

    if (input.event.eventKind === "settled") {
      if (hasOpenPending) {
        return [
          buildEventPlanItem({
            bookId: input.sourceBookId,
            request: buildRequestBase({
              templateKey: POSTING_TEMPLATE_KEY.TRANSFER_PENDING_SETTLE,
              currency: input.sourceCurrency,
              amountMinor: sourceAmountMinor,
              bookId: input.sourceBookId,
              dimensions: {},
              refs: {
                transferDocumentId: input.operation.id,
                eventIdempotencyKey,
                pendingIndex: "0",
              },
              pending: {
                pendingId:
                  sourcePendingId ??
                  (() => {
                    throw new InvalidStateError(
                      "pendingId is required to settle a submitted transfer event",
                    );
                })(),
                ref: sourcePendingRef,
                amountMinor: sourceAmountMinor,
              },
            }),
          }),
        ];
      }

      return [
        buildEventPlanItem({
          bookId: input.sourceBookId,
          request: buildRequestBase({
            templateKey: POSTING_TEMPLATE_KEY.TRANSFER_INTRA_IMMEDIATE,
            currency: input.sourceCurrency,
            amountMinor: sourceAmountMinor,
            bookId: input.sourceBookId,
            dimensions: {
              sourceRequisiteId: input.operation.sourceAccountId,
              destinationRequisiteId: input.operation.destinationAccountId,
            },
          }),
        }),
      ];
    }

    if (!hasOpenPending) {
      return [];
    }

    return [
      buildEventPlanItem({
        bookId: input.sourceBookId,
        request: buildRequestBase({
          templateKey: POSTING_TEMPLATE_KEY.TRANSFER_PENDING_VOID,
          currency: input.sourceCurrency,
          amountMinor: sourceAmountMinor,
          bookId: input.sourceBookId,
          dimensions: {},
          refs: {
            transferDocumentId: input.operation.id,
            eventIdempotencyKey,
            pendingIndex: "0",
          },
          pending: {
            pendingId:
              sourcePendingId ??
              (() => {
                throw new InvalidStateError(
                  "pendingId is required to reverse a submitted transfer event",
                );
              })(),
            ref: sourcePendingRef,
            amountMinor: 0n,
          },
        }),
      }),
    ];
  }

  if (input.operation.operationKind === "intercompany_funding") {
    const sourceAmountMinor = asPositiveBigInt(input.operation.sourceAmountMinor);
    const destinationAmountMinor = asPositiveBigInt(
      input.operation.destinationAmountMinor,
    );
    if (
      !input.sourceBookId ||
      !input.destinationBookId ||
      !input.sourceCurrency ||
      !input.destinationCurrency ||
      !input.sourceAccount ||
      !input.destinationAccount ||
      !sourceAmountMinor ||
      !destinationAmountMinor
    ) {
      return [];
    }

    if (input.event.eventKind === "submitted") {
      return [
        buildEventPlanItem({
          bookId: input.sourceBookId,
          idempotencySuffix: "source",
          request: buildRequestBase({
            templateKey: POSTING_TEMPLATE_KEY.TREASURY_CASH_OUT_PENDING,
            currency: input.sourceCurrency,
            amountMinor: sourceAmountMinor,
            bookId: input.sourceBookId,
            dimensions: {
              orderId: input.operation.id,
              organizationRequisiteId: input.sourceAccount.id,
            },
            pending: {
              ref: sourcePendingRef,
              timeoutSeconds,
            },
          }),
        }),
        buildEventPlanItem({
          bookId: input.destinationBookId,
          idempotencySuffix: "destination",
          request: buildRequestBase({
            templateKey: POSTING_TEMPLATE_KEY.TREASURY_CASH_IN_PENDING,
            currency: input.destinationCurrency,
            amountMinor: destinationAmountMinor,
            bookId: input.destinationBookId,
            dimensions: {
              orderId: input.operation.id,
              organizationRequisiteId: input.destinationAccount.id,
            },
            pending: {
              ref: destinationPendingRef,
              timeoutSeconds,
            },
          }),
        }),
      ];
    }

    if (input.event.eventKind === "settled") {
      if (hasOpenPending) {
        return [
          buildEventPlanItem({
            bookId: input.sourceBookId,
            idempotencySuffix: "source",
            request: buildRequestBase({
              templateKey: POSTING_TEMPLATE_KEY.TREASURY_CASH_PENDING_SETTLE,
              currency: input.sourceCurrency,
              amountMinor: sourceAmountMinor,
              bookId: input.sourceBookId,
              dimensions: {},
              refs: {
                orderId: input.operation.id,
                eventIdempotencyKey,
                pendingSide: "source",
              },
              pending: {
                pendingId:
                  sourcePendingId ??
                  (() => {
                    throw new InvalidStateError(
                      "sourcePendingId is required to settle a submitted intercompany funding event",
                    );
                })(),
                ref: sourcePendingRef,
                amountMinor: sourceAmountMinor,
              },
            }),
          }),
          buildEventPlanItem({
            bookId: input.destinationBookId,
            idempotencySuffix: "destination",
            request: buildRequestBase({
              templateKey: POSTING_TEMPLATE_KEY.TREASURY_CASH_PENDING_SETTLE,
              currency: input.destinationCurrency,
              amountMinor: destinationAmountMinor,
              bookId: input.destinationBookId,
              dimensions: {},
              refs: {
                orderId: input.operation.id,
                eventIdempotencyKey,
                pendingSide: "destination",
              },
              pending: {
                pendingId:
                  destinationPendingId ??
                  (() => {
                    throw new InvalidStateError(
                      "destinationPendingId is required to settle a submitted intercompany funding event",
                    );
                })(),
                ref: destinationPendingRef,
                amountMinor: destinationAmountMinor,
              },
            }),
          }),
        ];
      }

      return [
        buildEventPlanItem({
          bookId: input.sourceBookId,
          idempotencySuffix: "source",
          request: buildRequestBase({
            templateKey: POSTING_TEMPLATE_KEY.TREASURY_CASH_OUT_IMMEDIATE,
            currency: input.sourceCurrency,
            amountMinor: sourceAmountMinor,
            bookId: input.sourceBookId,
            dimensions: {
              orderId: input.operation.id,
              organizationRequisiteId: input.sourceAccount.id,
            },
          }),
        }),
        buildEventPlanItem({
          bookId: input.destinationBookId,
          idempotencySuffix: "destination",
          request: buildRequestBase({
            templateKey: POSTING_TEMPLATE_KEY.TREASURY_CASH_IN_IMMEDIATE,
            currency: input.destinationCurrency,
            amountMinor: destinationAmountMinor,
            bookId: input.destinationBookId,
            dimensions: {
              orderId: input.operation.id,
              organizationRequisiteId: input.destinationAccount.id,
            },
          }),
        }),
      ];
    }

    if (!hasOpenPending) {
      return [];
    }

    return [
      buildEventPlanItem({
        bookId: input.sourceBookId,
        idempotencySuffix: "source",
        request: buildRequestBase({
          templateKey: POSTING_TEMPLATE_KEY.TREASURY_CASH_PENDING_VOID,
          currency: input.sourceCurrency,
          amountMinor: sourceAmountMinor,
          bookId: input.sourceBookId,
          dimensions: {},
          refs: {
            orderId: input.operation.id,
            eventIdempotencyKey,
            pendingSide: "source",
          },
          pending: {
            pendingId:
              sourcePendingId ??
              (() => {
                throw new InvalidStateError(
                  "sourcePendingId is required to reverse a submitted intercompany funding event",
                );
              })(),
            ref: sourcePendingRef,
            amountMinor: 0n,
          },
        }),
      }),
      buildEventPlanItem({
        bookId: input.destinationBookId,
        idempotencySuffix: "destination",
        request: buildRequestBase({
          templateKey: POSTING_TEMPLATE_KEY.TREASURY_CASH_PENDING_VOID,
          currency: input.destinationCurrency,
          amountMinor: destinationAmountMinor,
          bookId: input.destinationBookId,
          dimensions: {},
          refs: {
            orderId: input.operation.id,
            eventIdempotencyKey,
            pendingSide: "destination",
          },
          pending: {
            pendingId:
              destinationPendingId ??
              (() => {
                throw new InvalidStateError(
                  "destinationPendingId is required to reverse a submitted intercompany funding event",
                );
              })(),
            ref: destinationPendingRef,
            amountMinor: 0n,
          },
        }),
      }),
    ];
  }

  if (input.operation.operationKind === "fx_conversion") {
    const sourceAmountMinor = asPositiveBigInt(input.operation.sourceAmountMinor);
    const destinationAmountMinor = asPositiveBigInt(
      input.operation.destinationAmountMinor,
    );
    if (
      !input.sourceBookId ||
      !input.destinationBookId ||
      !input.sourceCurrency ||
      !input.destinationCurrency ||
      !input.sourceAccount ||
      !input.destinationAccount ||
      !sourceAmountMinor ||
      !destinationAmountMinor
    ) {
      return [];
    }

    const quoteSnapshot =
      (input.operation.payload?.quoteSnapshot as JsonRecord | undefined) ?? null;
    const quoteRef = asString(quoteSnapshot?.quoteId) ?? input.operation.id;
    const chainId = asString(metadata.chainId) ?? `treasury:fx:${input.operation.id}`;
    const baseDimensions = {
      sourceRequisiteId: input.sourceAccount.id,
      destinationRequisiteId: input.destinationAccount.id,
      sourceOrganizationId: input.sourceAccount.ownerEntityId,
      destinationOrganizationId: input.destinationAccount.ownerEntityId,
    };

    if (input.event.eventKind === "submitted") {
      return [
        buildEventPlanItem({
          bookId: input.sourceBookId,
          idempotencySuffix: "source",
          request: buildRequestBase({
            templateKey: POSTING_TEMPLATE_KEY.TREASURY_FX_SOURCE_PENDING,
            currency: input.sourceCurrency,
            amountMinor: sourceAmountMinor,
            bookId: input.sourceBookId,
            dimensions: baseDimensions,
            refs: {
              fxExecuteDocumentId: input.operation.id,
              quoteRef,
              chainId,
            },
            pending: {
              ref: sourcePendingRef,
              timeoutSeconds,
            },
          }),
        }),
        buildEventPlanItem({
          bookId: input.destinationBookId,
          idempotencySuffix: "destination",
          request: buildRequestBase({
            templateKey: POSTING_TEMPLATE_KEY.TREASURY_FX_DESTINATION_PENDING,
            currency: input.destinationCurrency,
            amountMinor: destinationAmountMinor,
            bookId: input.destinationBookId,
            dimensions: baseDimensions,
            refs: {
              fxExecuteDocumentId: input.operation.id,
              quoteRef,
              chainId,
            },
            pending: {
              ref: destinationPendingRef,
              timeoutSeconds,
            },
          }),
        }),
      ];
    }

    if (input.event.eventKind === "settled") {
      if (hasOpenPending) {
        return [
          buildEventPlanItem({
            bookId: input.sourceBookId,
            idempotencySuffix: "source",
            request: buildRequestBase({
              templateKey: POSTING_TEMPLATE_KEY.TREASURY_FX_PENDING_SETTLE,
              currency: input.sourceCurrency,
              amountMinor: sourceAmountMinor,
              bookId: input.sourceBookId,
              dimensions: {},
              refs: {
                fxExecuteDocumentId: input.operation.id,
                eventIdempotencyKey,
              },
              pending: {
                pendingId:
                  sourcePendingId ??
                  (() => {
                    throw new InvalidStateError(
                      "sourcePendingId is required to settle a submitted FX event",
                    );
                })(),
                ref: sourcePendingRef,
                amountMinor: sourceAmountMinor,
              },
            }),
          }),
          buildEventPlanItem({
            bookId: input.destinationBookId,
            idempotencySuffix: "destination",
            request: buildRequestBase({
              templateKey: POSTING_TEMPLATE_KEY.TREASURY_FX_PENDING_SETTLE,
              currency: input.destinationCurrency,
              amountMinor: destinationAmountMinor,
              bookId: input.destinationBookId,
              dimensions: {},
              refs: {
                fxExecuteDocumentId: input.operation.id,
                eventIdempotencyKey,
              },
              pending: {
                pendingId:
                  destinationPendingId ??
                  (() => {
                    throw new InvalidStateError(
                      "destinationPendingId is required to settle a submitted FX event",
                    );
                })(),
                ref: destinationPendingRef,
                amountMinor: destinationAmountMinor,
              },
            }),
          }),
        ];
      }

      const quotePayload =
        quoteSnapshot?.payload && typeof quoteSnapshot.payload === "object"
          ? (quoteSnapshot.payload as JsonRecord)
          : null;
      const financialLines = parseFxFinancialLines(
        quotePayload?.financialLines ?? quoteSnapshot?.financialLines,
      );

      return [
        buildEventPlanItem({
          bookId: input.sourceBookId,
          idempotencySuffix: "source",
          request: buildRequestBase({
            templateKey: POSTING_TEMPLATE_KEY.TREASURY_FX_SOURCE_IMMEDIATE,
            currency: input.sourceCurrency,
            amountMinor: sourceAmountMinor,
            bookId: input.sourceBookId,
            dimensions: baseDimensions,
            refs: {
              fxExecuteDocumentId: input.operation.id,
              quoteRef,
              chainId,
            },
          }),
        }),
        buildEventPlanItem({
          bookId: input.destinationBookId,
          idempotencySuffix: "destination",
          request: buildRequestBase({
            templateKey: POSTING_TEMPLATE_KEY.TREASURY_FX_DESTINATION_IMMEDIATE,
            currency: input.destinationCurrency,
            amountMinor: destinationAmountMinor,
            bookId: input.destinationBookId,
            dimensions: baseDimensions,
            refs: {
              fxExecuteDocumentId: input.operation.id,
              quoteRef,
              chainId,
            },
          }),
        }),
        ...financialLines.map((line, index) => {
          const postingTemplate = resolveTreasuryFxFinancialLineTemplate(line);
          const lineBookId =
            line.currency === input.destinationCurrency
              ? input.destinationBookId
              : input.sourceBookId;

          return buildEventPlanItem({
            bookId: lineBookId!,
            idempotencySuffix: `line:${index + 1}`,
            request: buildRequestBase({
              templateKey: postingTemplate.templateKey,
              currency: line.currency,
              amountMinor: postingTemplate.amountMinor,
              bookId: lineBookId!,
              dimensions: {
                ...baseDimensions,
                feeBucket: line.bucket,
              },
              refs: {
                fxExecuteDocumentId: input.operation.id,
                quoteRef,
                chainId,
                componentId: line.id,
                componentIndex: String(index + 1),
              },
              memo: line.memo,
            }),
          });
        }),
      ];
    }

    if (!hasOpenPending) {
      return [];
    }

    return [
      buildEventPlanItem({
        bookId: input.sourceBookId,
        idempotencySuffix: "source",
        request: buildRequestBase({
          templateKey: POSTING_TEMPLATE_KEY.TREASURY_FX_PENDING_VOID,
          currency: input.sourceCurrency,
          amountMinor: sourceAmountMinor,
          bookId: input.sourceBookId,
          dimensions: {},
          refs: {
            fxExecuteDocumentId: input.operation.id,
            eventIdempotencyKey,
          },
          pending: {
            pendingId:
              sourcePendingId ??
              (() => {
                throw new InvalidStateError(
                  "sourcePendingId is required to reverse a submitted FX event",
                );
              })(),
            ref: sourcePendingRef,
            amountMinor: 0n,
          },
        }),
      }),
      buildEventPlanItem({
        bookId: input.destinationBookId,
        idempotencySuffix: "destination",
        request: buildRequestBase({
          templateKey: POSTING_TEMPLATE_KEY.TREASURY_FX_PENDING_VOID,
          currency: input.destinationCurrency,
          amountMinor: destinationAmountMinor,
          bookId: input.destinationBookId,
          dimensions: {},
          refs: {
            fxExecuteDocumentId: input.operation.id,
            eventIdempotencyKey,
          },
          pending: {
            pendingId:
              destinationPendingId ??
              (() => {
                throw new InvalidStateError(
                  "destinationPendingId is required to reverse a submitted FX event",
                );
              })(),
            ref: destinationPendingRef,
            amountMinor: 0n,
          },
        }),
      }),
    ];
  }

  return [];
}

export function buildPositionOpenPostingPlan(input: {
  position: TreasuryPosition;
  currency: string;
  bookId: string;
}): TreasuryPostingPlanInput[] {
  const templateKey = resolvePositionTemplate({
    kind: input.position.positionKind,
    action: "open",
  });

  if (!templateKey) {
    return [];
  }

  let dimensions: Record<string, string>;

  if (input.position.positionKind === "customer_liability") {
    dimensions = {
      orderId: input.position.id,
      customerId:
        input.position.beneficialOwnerId ??
        (() => {
          throw new InvalidStateError(
            "customer_liability position requires beneficialOwnerId",
          );
        })(),
    };
  } else {
    dimensions = {
      orderId: input.position.id,
      counterpartyId:
        input.position.counterpartyEntityId ??
        (() => {
          throw new InvalidStateError(
            `${input.position.positionKind} position requires counterpartyEntityId`,
          );
        })(),
    };
  }

  return [
    {
      accountingSourceId: ACCOUNTING_SOURCE_ID.TREASURY_POSITION_OPENED,
      source: {
        type: "treasury/positions/open",
        id: input.position.id,
      },
      idempotencyKey: `treasury:position-open:${input.position.id}`,
      postingDate: input.position.createdAt,
      bookId: input.bookId,
      plan: buildPlan({
        operationCode: OPERATION_CODE.TREASURY_POSITION_OPENED,
        payload: {
          positionId: input.position.id,
          positionKind: input.position.positionKind,
          originOperationId: input.position.originOperationId,
        },
        request: {
          templateKey,
          effectiveAt: input.position.createdAt,
          currency: input.currency,
          amountMinor: BigInt(input.position.amountMinor),
          bookRefs: {
            bookId: input.bookId,
          },
          dimensions,
          memo: null,
        },
      }),
    },
  ];
}

export function buildPositionSettlePostingPlan(input: {
  position: TreasuryPosition;
  settledAmountMinor: bigint;
  currency: string;
  bookId: string;
}): TreasuryPostingPlanInput[] {
  const templateKey = resolvePositionTemplate({
    kind: input.position.positionKind,
    action: "settle",
  });

  if (!templateKey) {
    return [];
  }

  let dimensions: Record<string, string>;

  if (input.position.positionKind === "customer_liability") {
    dimensions = {
      orderId: input.position.id,
      customerId:
        input.position.beneficialOwnerId ??
        (() => {
          throw new InvalidStateError(
            "customer_liability position requires beneficialOwnerId",
          );
        })(),
    };
  } else {
    dimensions = {
      orderId: input.position.id,
      counterpartyId:
        input.position.counterpartyEntityId ??
        (() => {
          throw new InvalidStateError(
            `${input.position.positionKind} position requires counterpartyEntityId`,
          );
        })(),
    };
  }

  return [
    {
      accountingSourceId: ACCOUNTING_SOURCE_ID.TREASURY_POSITION_SETTLED,
      source: {
        type: "treasury/positions/settle",
        id: `${input.position.id}:${input.position.settledMinor}`,
      },
      idempotencyKey: `treasury:position-settle:${input.position.id}:${input.position.settledMinor}`,
      postingDate: input.position.updatedAt,
      bookId: input.bookId,
      plan: buildPlan({
        operationCode: OPERATION_CODE.TREASURY_POSITION_SETTLED,
        payload: {
          positionId: input.position.id,
          positionKind: input.position.positionKind,
        },
        request: {
          templateKey,
          effectiveAt: input.position.updatedAt,
          currency: input.currency,
          amountMinor: input.settledAmountMinor,
          bookRefs: {
            bookId: input.bookId,
          },
          dimensions,
          memo: null,
        },
      }),
    },
  ];
}
