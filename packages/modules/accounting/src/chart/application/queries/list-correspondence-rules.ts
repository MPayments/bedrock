import type { ChartReads } from "../ports/chart.reads";
import { CorrespondenceRule } from "../../domain";

export class ListCorrespondenceRulesQuery {
  constructor(private readonly reads: ChartReads) {}

  async execute() {
    const rows = await this.reads.listCorrespondenceRules();
    return rows.map((row) => CorrespondenceRule.fromSnapshot(row).toSnapshot());
  }
}
