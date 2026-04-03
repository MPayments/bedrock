import { DomainError } from "@bedrock/shared/core/domain";
import { ValidationError } from "@bedrock/shared/core/errors";

import { NotFoundError, QuoteExpiredError } from "../../../errors";
import { enrichPairCurrencyRecord } from "../../../shared/application/currency-codes";
import type { CurrenciesPort } from "../../../shared/application/external-ports";
import { Quote } from "../../domain/quote";
import {
  MarkQuoteUsedInputSchema,
  type MarkQuoteUsedInput,
} from "../contracts/commands";
import type { QuoteRecord } from "../ports";
import type { QuotesRepository } from "../ports/quotes.repository";

function buildQuoteUsageConflictMessage(quote: QuoteRecord): string {
  return `Quote ${quote.id} is already used by ${quote.usedByRef ?? "another document"}`;
}

export class MarkQuoteUsedCommand {
  constructor(
    private readonly currencies: CurrenciesPort,
    private readonly quotesRepository: QuotesRepository,
  ) {}

  async execute(input: MarkQuoteUsedInput): Promise<QuoteRecord> {
    const validated = MarkQuoteUsedInputSchema.parse(input);
    const quoteRow = await this.quotesRepository.findQuoteById(validated.quoteId);

    if (!quoteRow) {
      throw new NotFoundError("Quote", validated.quoteId);
    }

    if (quoteRow.status === "used") {
      if (
        quoteRow.usedByRef === validated.usedByRef &&
        (validated.usedDocumentId == null ||
          quoteRow.usedDocumentId === validated.usedDocumentId) &&
        (validated.dealId == null || quoteRow.dealId === validated.dealId)
      ) {
        return enrichPairCurrencyRecord(this.currencies, quoteRow);
      }

      throw new ValidationError(buildQuoteUsageConflictMessage(quoteRow));
    }

    if (quoteRow.status !== "active") {
      throw new ValidationError(`Quote ${validated.quoteId} is not active`);
    }

    try {
      const transition = Quote.fromSnapshot(quoteRow).markUsed({
        dealId: validated.dealId ?? null,
        usedByRef: validated.usedByRef,
        usedDocumentId: validated.usedDocumentId ?? null,
        at: validated.at,
      });

      if (transition.kind === "noop") {
        return enrichPairCurrencyRecord(this.currencies, quoteRow);
      }
    } catch (error) {
      if (
        error instanceof DomainError &&
        error.code === "treasury.quote.expired"
      ) {
        throw new QuoteExpiredError("Quote expired");
      }

      throw error;
    }

    const updated = await this.quotesRepository.markQuoteUsedIfActive({
      dealId: validated.dealId ?? null,
      quoteId: validated.quoteId,
      usedByRef: validated.usedByRef,
      usedDocumentId: validated.usedDocumentId ?? null,
      at: validated.at,
    });

    if (updated) {
      return enrichPairCurrencyRecord(this.currencies, updated);
    }

    const reloaded = await this.quotesRepository.findQuoteById(validated.quoteId);

    if (!reloaded) {
      throw new NotFoundError("Quote", validated.quoteId);
    }

    if (
      reloaded.status === "used" &&
      reloaded.usedByRef === validated.usedByRef &&
      (validated.usedDocumentId == null ||
        reloaded.usedDocumentId === validated.usedDocumentId) &&
      (validated.dealId == null || reloaded.dealId === validated.dealId)
    ) {
      return enrichPairCurrencyRecord(this.currencies, reloaded);
    }

    if (reloaded.status === "used") {
      throw new ValidationError(buildQuoteUsageConflictMessage(reloaded));
    }

    if (reloaded.status !== "active") {
      throw new ValidationError(`Quote ${validated.quoteId} is not active`);
    }

    throw new ValidationError(
      `Quote ${validated.quoteId} could not be marked as used`,
    );
  }
}
