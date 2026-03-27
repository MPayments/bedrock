import {
  createTransactionalPort,
  type PersistenceContext,
  type Transaction,
  type TransactionalPort,
} from "@bedrock/platform/persistence";

import { DrizzleTreasuryCoreRepository } from "../../../core/adapters/drizzle/core.repository";
import { DrizzleTreasuryQuoteFeeComponentsRepository } from "../../../quotes/adapters/drizzle/quote-fee-components.repository";
import { DrizzleTreasuryQuoteFinancialLinesRepository } from "../../../quotes/adapters/drizzle/quote-financial-lines.repository";
import { DrizzleTreasuryQuotesRepository } from "../../../quotes/adapters/drizzle/quotes.repository";
import type {
  QuotesCommandTx,
  QuotesCommandUnitOfWork,
} from "../../../quotes/application/ports/quotes.uow";
import type {
  TreasuryCoreTx,
  TreasuryCoreUnitOfWork,
} from "../../application/core-ports";

type TreasuryTx = QuotesCommandTx & TreasuryCoreTx;

function bindTreasuryTx(tx: Transaction): TreasuryTx {
  const core = new DrizzleTreasuryCoreRepository(tx);

  return Object.assign(core, {
    quotes: new DrizzleTreasuryQuotesRepository(tx),
    quoteFeeComponents: new DrizzleTreasuryQuoteFeeComponentsRepository(tx),
    quoteFinancialLines: new DrizzleTreasuryQuoteFinancialLinesRepository(tx),
  });
}

export class DrizzleTreasuryUnitOfWork
  implements QuotesCommandUnitOfWork, TreasuryCoreUnitOfWork
{
  private readonly transactional: TransactionalPort<TreasuryTx>;

  constructor(input: { persistence: PersistenceContext }) {
    this.transactional = createTransactionalPort(
      input.persistence,
      bindTreasuryTx,
    );
  }

  run<T>(work: (tx: TreasuryTx) => Promise<T>): Promise<T> {
    return this.transactional.withTransaction((tx) => work(tx));
  }
}
