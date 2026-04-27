import {
  createQuoteExecutionsServiceContext,
  type QuoteExecutionsServiceDeps,
} from "./context";
import {
  AttachQuoteExecutionPostingInputSchema,
  CancelQuoteExecutionInputSchema,
  ConfirmQuoteExecutionInputSchema,
  CreateQuoteExecutionInputSchema,
  ExpireQuoteExecutionInputSchema,
  GetQuoteExecutionByIdInputSchema,
  ListQuoteExecutionsQuerySchema,
  QuoteExecutionListResponseSchema,
  SubmitQuoteExecutionInputSchema,
  type AttachQuoteExecutionPostingInput,
  type CancelQuoteExecutionInput,
  type ConfirmQuoteExecutionInput,
  type CreateQuoteExecutionInput,
  type ExpireQuoteExecutionInput,
  type GetQuoteExecutionByIdInput,
  type ListQuoteExecutionsQuery,
  type SubmitQuoteExecutionInput,
} from "./contracts";
import {
  NotFoundError,
  QuoteExecutionConflictError,
  QuoteExecutionNotFoundError,
  ValidationError,
} from "../../errors";
import { QuoteExecutionSchema } from "../contracts/dto";
import { QuoteExecution } from "../domain/quote-execution";

function serializeBigInt(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(serializeBigInt);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serializeBigInt(item)]),
    );
  }
  return value;
}

export function createQuoteExecutionsService(
  deps: QuoteExecutionsServiceDeps,
) {
  const context = createQuoteExecutionsServiceContext(deps);

  async function assertExecutableQuote(input: {
    quoteId: string;
    now: Date;
  }) {
    try {
      const quoteDetails = await context.quotes.getQuoteDetails({
        quoteRef: input.quoteId,
      });
      if (
        quoteDetails.quote.status === "expired" ||
        quoteDetails.quote.status === "cancelled" ||
        new Date(quoteDetails.quote.expiresAt).getTime() <= input.now.getTime()
      ) {
        throw new ValidationError(
          `Quote ${input.quoteId} is not executable`,
        );
      }
      return quoteDetails;
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      if (error instanceof NotFoundError) throw error;
      throw error;
    }
  }

  async function create(raw: CreateQuoteExecutionInput) {
    const input = CreateQuoteExecutionInputSchema.parse(raw);
    const now = context.runtime.now();
    const id = input.id ?? context.runtime.generateUuid();
    const quoteDetails = await assertExecutableQuote({
      now,
      quoteId: input.quoteId,
    });
    const quoteLeg =
      input.quoteLegIdx !== null
        ? quoteDetails.legs.find((leg) => leg.idx === input.quoteLegIdx)
        : null;
    const created = QuoteExecution.create(
      {
        dealId: input.dealId,
        fromAmountMinor: input.fromAmountMinor,
        fromCurrencyId: input.fromCurrencyId,
        id,
        origin: input.origin,
        quoteId: input.quoteId,
        quoteLegIdx: input.quoteLegIdx,
        quoteSnapshot: input.quoteSnapshot ?? serializeBigInt(quoteDetails),
        rateDen: input.rateDen ?? quoteLeg?.rateDen ?? quoteDetails.quote.rateDen,
        rateNum: input.rateNum ?? quoteLeg?.rateNum ?? quoteDetails.quote.rateNum,
        executionParties: input.executionParties,
        sourceRef: input.sourceRef,
        toAmountMinor: input.toAmountMinor,
        toCurrencyId: input.toCurrencyId,
        treasuryOrderId: input.treasuryOrderId,
      },
      now,
    );
    const execution =
      input.initialState === "pending" ? created.markPending(now) : created;
    const inserted = await context.repository.insert(execution.toSnapshot());
    if (!inserted) {
      throw new QuoteExecutionConflictError(input.sourceRef);
    }
    return QuoteExecutionSchema.parse(inserted);
  }

  async function submit(raw: SubmitQuoteExecutionInput) {
    const input = SubmitQuoteExecutionInputSchema.parse(raw);
    const current = await context.repository.findById(input.executionId);
    if (!current) {
      throw new QuoteExecutionNotFoundError(input.executionId);
    }
    const next = QuoteExecution.fromSnapshot(current).submit({
      providerRef: input.providerRef,
      providerSnapshot: input.providerSnapshot,
      submittedAt: context.runtime.now(),
    });
    const updated = await context.repository.update(next.toSnapshot());
    if (!updated) {
      throw new QuoteExecutionNotFoundError(input.executionId);
    }
    return QuoteExecutionSchema.parse(updated);
  }

  async function confirm(raw: ConfirmQuoteExecutionInput) {
    const input = ConfirmQuoteExecutionInputSchema.parse(raw);
    const current = await context.repository.findById(input.executionId);
    if (!current) {
      throw new QuoteExecutionNotFoundError(input.executionId);
    }
    const aggregate = QuoteExecution.fromSnapshot(current);
    const now = context.runtime.now();
    const next =
      input.outcome === "settled"
        ? aggregate.complete(now)
        : aggregate.fail({
            failedAt: now,
            failureReason: input.failureReason,
          });
    const updated = await context.repository.update(next.toSnapshot());
    if (!updated) {
      throw new QuoteExecutionNotFoundError(input.executionId);
    }
    return QuoteExecutionSchema.parse(updated);
  }

  async function cancel(raw: CancelQuoteExecutionInput) {
    const input = CancelQuoteExecutionInputSchema.parse(raw);
    const current = await context.repository.findById(input.executionId);
    if (!current) {
      throw new QuoteExecutionNotFoundError(input.executionId);
    }
    const next = QuoteExecution.fromSnapshot(current).cancel(
      context.runtime.now(),
    );
    const updated = await context.repository.update(next.toSnapshot());
    if (!updated) {
      throw new QuoteExecutionNotFoundError(input.executionId);
    }
    return QuoteExecutionSchema.parse(updated);
  }

  async function expire(raw: ExpireQuoteExecutionInput) {
    const input = ExpireQuoteExecutionInputSchema.parse(raw);
    const current = await context.repository.findById(input.executionId);
    if (!current) {
      throw new QuoteExecutionNotFoundError(input.executionId);
    }
    const next = QuoteExecution.fromSnapshot(current).expire(
      context.runtime.now(),
    );
    const updated = await context.repository.update(next.toSnapshot());
    if (!updated) {
      throw new QuoteExecutionNotFoundError(input.executionId);
    }
    return QuoteExecutionSchema.parse(updated);
  }

  async function attachPosting(raw: AttachQuoteExecutionPostingInput) {
    const input = AttachQuoteExecutionPostingInputSchema.parse(raw);
    const current = await context.repository.findById(input.executionId);
    if (!current) {
      throw new QuoteExecutionNotFoundError(input.executionId);
    }
    const next = QuoteExecution.fromSnapshot(current).attachPosting(
      { documentId: input.documentId, kind: input.kind },
      context.runtime.now(),
    );
    const updated = await context.repository.update(next.toSnapshot());
    if (!updated) {
      throw new QuoteExecutionNotFoundError(input.executionId);
    }
    return QuoteExecutionSchema.parse(updated);
  }

  async function findById(raw: GetQuoteExecutionByIdInput) {
    const input = GetQuoteExecutionByIdInputSchema.parse(raw);
    const execution = await context.repository.findById(input.executionId);
    return execution ? QuoteExecutionSchema.parse(execution) : null;
  }

  async function list(raw: ListQuoteExecutionsQuery) {
    const input = ListQuoteExecutionsQuerySchema.parse(raw);
    const result = await context.repository.list(input);
    return QuoteExecutionListResponseSchema.parse({
      data: result.rows,
      limit: input.limit,
      offset: input.offset,
      total: result.total,
    });
  }

  return {
    commands: { attachPosting, cancel, confirm, create, expire, submit },
    queries: { findById, list },
  };
}

export type QuoteExecutionsService = ReturnType<
  typeof createQuoteExecutionsService
>;
