import {
  Entity,
  normalizeOptionalText,
  normalizeRequiredText,
} from "@bedrock/shared/core/domain";

export interface ChartTemplateAccountSnapshot {
  accountNo: string;
  name: string;
  kind: "asset" | "liability" | "equity" | "revenue" | "expense" | "active_passive";
  normalSide: "debit" | "credit" | "both";
  postingAllowed: boolean;
  enabled: boolean;
  parentAccountNo: string | null;
  createdAt: Date;
}

export class ChartTemplateAccount extends Entity<string> {
  private constructor(
    private readonly snapshot: ChartTemplateAccountSnapshot,
  ) {
    super(snapshot.accountNo);
  }

  static reconstitute(
    snapshot: ChartTemplateAccountSnapshot,
  ): ChartTemplateAccount {
    return new ChartTemplateAccount({
      ...snapshot,
      accountNo: normalizeRequiredText(
        snapshot.accountNo,
        "chart_template_account.account_no_required",
        "accountNo",
      ),
      name: normalizeRequiredText(
        snapshot.name,
        "chart_template_account.name_required",
        "name",
      ),
      parentAccountNo: normalizeOptionalText(snapshot.parentAccountNo),
    });
  }

  toSnapshot(): ChartTemplateAccountSnapshot {
    return { ...this.snapshot };
  }
}
