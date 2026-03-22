import { ChartTemplateAccount } from "../../domain";
import type { ChartReads } from "../ports/chart.reads";

export class ListTemplateAccountsQuery {
  constructor(private readonly reads: ChartReads) {}

  async execute() {
    const rows = await this.reads.listTemplateAccounts();
    return rows.map((row) => ChartTemplateAccount.fromSnapshot(row).toSnapshot());
  }
}
