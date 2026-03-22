import {
  BalanceSubjectSchema,
  type BalanceSnapshot,
  type BalanceSubjectInput,
} from "../../contracts";
import { createZeroBalanceSnapshot } from "../../domain/balance-position";
import type { LedgerBalancesReads } from "../ports/balances.reads";

export class GetBalanceQuery {
  constructor(private readonly reads: LedgerBalancesReads) {}

  async execute(input: BalanceSubjectInput): Promise<BalanceSnapshot> {
    const subject = BalanceSubjectSchema.parse(input);

    return (
      (await this.reads.getBalancePosition(subject)) ??
      createZeroBalanceSnapshot(subject)
    );
  }
}
