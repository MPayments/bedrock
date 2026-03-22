import type { Queryable } from "@bedrock/platform/persistence";

import { DrizzleBalancesReportingRepository } from "./balance-reporting.repository";
import { DrizzleBalancesStateRepository } from "./balance-state.repository";
import type { LedgerBalancesReads } from "../../application/ports/balances.reads";
import type {
  BalanceSubjectInput,
  ListOrganizationLiquidityRowsInput,
} from "../../contracts";

export class DrizzleBalancesReads implements LedgerBalancesReads {
  private readonly reporting;
  private readonly state;

  constructor(db: Queryable) {
    this.reporting = new DrizzleBalancesReportingRepository(db);
    this.state = new DrizzleBalancesStateRepository(db);
  }

  getBalancePosition(subject: BalanceSubjectInput) {
    return this.state.getBalancePosition(subject);
  }

  listOrganizationLiquidityRows(input: ListOrganizationLiquidityRowsInput) {
    return this.reporting.listOrganizationLiquidityRows(input);
  }
}
