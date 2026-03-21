import { Entity, normalizeRequiredText } from "@bedrock/shared/core/domain";

export interface CorrespondenceRuleSnapshot {
  id: string;
  postingCode: string;
  debitAccountNo: string;
  creditAccountNo: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCorrespondenceRuleProps {
  id: string;
  postingCode: string;
  debitAccountNo: string;
  creditAccountNo: string;
  enabled: boolean;
}

export class CorrespondenceRule extends Entity<string> {
  private constructor(
    private readonly snapshot: CorrespondenceRuleSnapshot,
  ) {
    super({ id: snapshot.id, props: {} });
  }

  static create(
    input: CreateCorrespondenceRuleProps,
    now: Date,
  ): CorrespondenceRule {
    return new CorrespondenceRule({
      id: input.id,
      postingCode: normalizeRequiredText(
        input.postingCode,
        "correspondence_rule.posting_code_required",
        "postingCode",
      ),
      debitAccountNo: normalizeRequiredText(
        input.debitAccountNo,
        "correspondence_rule.debit_account_required",
        "debitAccountNo",
      ),
      creditAccountNo: normalizeRequiredText(
        input.creditAccountNo,
        "correspondence_rule.credit_account_required",
        "creditAccountNo",
      ),
      enabled: input.enabled,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromSnapshot(snapshot: CorrespondenceRuleSnapshot): CorrespondenceRule {
    return new CorrespondenceRule({
      ...snapshot,
      postingCode: normalizeRequiredText(
        snapshot.postingCode,
        "correspondence_rule.posting_code_required",
        "postingCode",
      ),
      debitAccountNo: normalizeRequiredText(
        snapshot.debitAccountNo,
        "correspondence_rule.debit_account_required",
        "debitAccountNo",
      ),
      creditAccountNo: normalizeRequiredText(
        snapshot.creditAccountNo,
        "correspondence_rule.credit_account_required",
        "creditAccountNo",
      ),
    });
  }

  toSnapshot(): CorrespondenceRuleSnapshot {
    return { ...this.snapshot };
  }
}
