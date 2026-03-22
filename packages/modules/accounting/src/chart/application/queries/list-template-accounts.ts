import type { ChartReads } from "../ports/chart.reads";
import { ChartTemplateAccount } from "../../domain";

export class ListTemplateAccountsQuery {
  constructor(private readonly reads: ChartReads) {}

  async execute() {
    const rows = await this.reads.listTemplateAccounts();
    return rows.map((row) => ChartTemplateAccount.fromSnapshot(row).toSnapshot());
  }
}
