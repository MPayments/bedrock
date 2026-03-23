import {
  createTransactionalPort,
  type PersistenceContext,
  type Transaction,
  type TransactionalPort,
} from "@bedrock/platform/persistence";

import { DrizzleTreasuryQuoteFeeComponentsRepository } from "../../../quotes/adapters/drizzle/quote-fee-components.repository";
import { DrizzleTreasuryQuoteFinancialLinesRepository } from "../../../quotes/adapters/drizzle/quote-financial-lines.repository";
import { DrizzleTreasuryQuotesRepository } from "../../../quotes/adapters/drizzle/quotes.repository";
import type {
  QuotesCommandTx,
  QuotesCommandUnitOfWork,
} from "../../../quotes/application/ports/quotes.uow";

function bindTreasuryTx(tx: Transaction): QuotesCommandTx {
  return {
    quotes: new DrizzleTreasuryQuotesRepository(tx),
    quoteFeeComponents: new DrizzleTreasuryQuoteFeeComponentsRepository(tx),
    quoteFinancialLines: new DrizzleTreasuryQuoteFinancialLinesRepository(tx),
  };
}

export class DrizzleTreasuryUnitOfWork
  implements QuotesCommandUnitOfWork
{
  private readonly transactional: TransactionalPort<QuotesCommandTx>;

  constructor(input: { persistence: PersistenceContext }) {
    this.transactional = createTransactionalPort(
      input.persistence,
      bindTreasuryTx,
    );
  }

  run<T>(work: (tx: QuotesCommandTx) => Promise<T>): Promise<T> {
    return this.transactional.withTransaction((tx) => work(tx));
  }
}
