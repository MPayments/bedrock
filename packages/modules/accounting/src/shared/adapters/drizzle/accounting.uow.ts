import {
  createTransactionalPort,
  type PersistenceContext,
  type Transaction,
  type TransactionalPort,
} from "@bedrock/platform/persistence";

import { DrizzleChartStore } from "../../../chart/adapters/drizzle/chart-repository";
import type {
  ChartCommandTx,
  ChartCommandUnitOfWork,
} from "../../../chart/application/ports/chart.uow";
import { DrizzlePackRepository } from "../../../packs/adapters/drizzle/pack.repository";
import type {
  PacksCommandTx,
  PacksCommandUnitOfWork,
} from "../../../packs/application/ports/packs.uow";
import { DrizzlePeriodRepository } from "../../../periods/adapters/drizzle/period.repository";
import type {
  PeriodsCommandTx,
  PeriodsCommandUnitOfWork,
} from "../../../periods/application/ports/periods.uow";

type AccountingTx = ChartCommandTx & PacksCommandTx & PeriodsCommandTx;

function bindAccountingTx(tx: Transaction): AccountingTx {
  return {
    chart: new DrizzleChartStore(tx),
    packs: new DrizzlePackRepository(tx),
    periods: new DrizzlePeriodRepository(tx),
  };
}

export class DrizzleAccountingUnitOfWork
  implements
    ChartCommandUnitOfWork,
    PacksCommandUnitOfWork,
    PeriodsCommandUnitOfWork
{
  private readonly transactional: TransactionalPort<AccountingTx>;

  constructor(input: { persistence: PersistenceContext }) {
    this.transactional = createTransactionalPort(
      input.persistence,
      bindAccountingTx,
    );
  }

  run<T>(work: (tx: AccountingTx) => Promise<T>): Promise<T> {
    return this.transactional.withTransaction((tx) => work(tx));
  }
}
