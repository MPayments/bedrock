import { Entity, invariant } from "@bedrock/shared/core/domain";

import type {
  ApplicableFeeRule,
  FeeAccountingTreatment,
  FeeCalcMethod,
  FeeComponent,
  FeeComponentKind,
  FeeDealDirection,
  FeeDealForm,
  FeeOperationKind,
  FeeSettlementMode,
} from "./fee-types";
import { calculateBpsAmount } from "./math";
import { resolveAccountingTreatment } from "./normalization";

export interface FeeRuleSnapshot {
  id: string;
  name: string;
  operationKind: FeeOperationKind;
  feeKind: FeeComponentKind;
  calcMethod: FeeCalcMethod;
  bps: number | null;
  fixedAmountMinor: bigint | null;
  fixedCurrencyId: string | null;
  settlementMode: FeeSettlementMode;
  accountingTreatment: FeeAccountingTreatment;
  dealDirection: FeeDealDirection | null;
  dealForm: FeeDealForm | null;
  fromCurrencyId: string | null;
  toCurrencyId: string | null;
  priority: number;
  isActive: boolean;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  memo: string | null;
  metadata: Record<string, string> | null;
  createdAt: Date | null;
}

export interface CreateFeeRuleProps {
  id: string;
  name: string;
  operationKind: FeeOperationKind;
  feeKind: FeeComponentKind;
  calcMethod: FeeCalcMethod;
  bps?: number;
  fixedAmountMinor?: bigint;
  fixedCurrencyId?: string | null;
  settlementMode?: FeeSettlementMode;
  accountingTreatment?: FeeAccountingTreatment;
  dealDirection?: FeeDealDirection;
  dealForm?: FeeDealForm;
  fromCurrencyId?: string | null;
  toCurrencyId?: string | null;
  priority?: number;
  isActive?: boolean;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  memo?: string;
  metadata?: Record<string, string>;
  createdAt?: Date | null;
}

function normalizeSnapshot(snapshot: FeeRuleSnapshot): FeeRuleSnapshot {
  invariant(snapshot.id.trim().length > 0, "Fee rule id is required", {
    code: "treasury.fee_rule.id_required",
  });
  invariant(snapshot.name.trim().length > 0, "Fee rule name is required", {
    code: "treasury.fee_rule.name_required",
  });
  invariant(snapshot.priority >= 0, "Fee rule priority must be non-negative", {
    code: "treasury.fee_rule.priority_invalid",
    meta: { priority: snapshot.priority },
  });

  if (snapshot.calcMethod === "bps") {
    invariant(snapshot.bps !== null, "bps fee rule requires bps", {
      code: "treasury.fee_rule.bps_required",
    });
    invariant(
      snapshot.fixedAmountMinor === null,
      "bps fee rule cannot define fixedAmountMinor",
      {
        code: "treasury.fee_rule.fixed_amount_forbidden",
      },
    );
  }

  if (snapshot.calcMethod === "fixed") {
    invariant(
      snapshot.fixedAmountMinor !== null,
      "fixed fee rule requires fixedAmountMinor",
      {
        code: "treasury.fee_rule.fixed_amount_required",
      },
    );
    invariant(snapshot.bps === null, "fixed fee rule cannot define bps", {
      code: "treasury.fee_rule.bps_forbidden",
    });
  }

  if (snapshot.effectiveTo) {
    invariant(
      snapshot.effectiveTo.getTime() > snapshot.effectiveFrom.getTime(),
      "effectiveTo must be later than effectiveFrom",
      {
        code: "treasury.fee_rule.effective_window_invalid",
      },
    );
  }

  return {
    ...snapshot,
    name: snapshot.name.trim(),
    settlementMode: snapshot.settlementMode ?? "in_ledger",
    accountingTreatment: resolveAccountingTreatment(snapshot),
    dealDirection: snapshot.dealDirection ?? null,
    dealForm: snapshot.dealForm ?? null,
    fromCurrencyId: snapshot.fromCurrencyId ?? null,
    toCurrencyId: snapshot.toCurrencyId ?? null,
    fixedCurrencyId: snapshot.fixedCurrencyId ?? null,
    effectiveTo: snapshot.effectiveTo ?? null,
    memo: snapshot.memo?.trim() || null,
    metadata: snapshot.metadata ? { ...snapshot.metadata } : null,
    createdAt: snapshot.createdAt ?? null,
  };
}

export class FeeRule extends Entity<string> {
  private readonly snapshot: FeeRuleSnapshot;

  private constructor(snapshot: FeeRuleSnapshot) {
    super({ id: snapshot.id, props: {} });
    this.snapshot = normalizeSnapshot(snapshot);
  }

  static create(input: CreateFeeRuleProps, now: Date): FeeRule {
    return new FeeRule({
      id: input.id,
      name: input.name,
      operationKind: input.operationKind,
      feeKind: input.feeKind,
      calcMethod: input.calcMethod,
      bps: input.bps ?? null,
      fixedAmountMinor: input.fixedAmountMinor ?? null,
      fixedCurrencyId: input.fixedCurrencyId ?? null,
      settlementMode: input.settlementMode ?? "in_ledger",
      accountingTreatment: resolveAccountingTreatment({
        accountingTreatment: input.accountingTreatment,
        settlementMode: input.settlementMode,
      }),
      dealDirection: input.dealDirection ?? null,
      dealForm: input.dealForm ?? null,
      fromCurrencyId: input.fromCurrencyId ?? null,
      toCurrencyId: input.toCurrencyId ?? null,
      priority: input.priority ?? 100,
      isActive: input.isActive ?? true,
      effectiveFrom: input.effectiveFrom ?? now,
      effectiveTo: input.effectiveTo ?? null,
      memo: input.memo ?? null,
      metadata: input.metadata ?? null,
      createdAt: input.createdAt ?? now,
    });
  }

  static fromSnapshot(snapshot: FeeRuleSnapshot): FeeRule {
    return new FeeRule(snapshot);
  }

  toSnapshot(): FeeRuleSnapshot {
    return {
      ...this.snapshot,
      metadata: this.snapshot.metadata ? { ...this.snapshot.metadata } : null,
    };
  }

  toApplicableRule(): ApplicableFeeRule {
    return {
      id: this.snapshot.id,
      calcMethod: this.snapshot.calcMethod,
      bps: this.snapshot.bps,
      fixedAmountMinor: this.snapshot.fixedAmountMinor,
      fixedCurrencyId: this.snapshot.fixedCurrencyId,
      feeKind: this.snapshot.feeKind,
      settlementMode: this.snapshot.settlementMode,
      accountingTreatment: this.snapshot.accountingTreatment,
      memo: this.snapshot.memo,
      metadata: this.snapshot.metadata,
    };
  }

  isApplicable(input: {
    operationKind: FeeOperationKind;
    at: Date;
    dealDirection?: FeeDealDirection;
    dealForm?: FeeDealForm;
    fromCurrencyId?: string | null;
    toCurrencyId?: string | null;
  }): boolean {
    if (
      !this.snapshot.isActive ||
      this.snapshot.operationKind !== input.operationKind
    ) {
      return false;
    }

    if (this.snapshot.effectiveFrom.getTime() > input.at.getTime()) {
      return false;
    }

    if (
      this.snapshot.effectiveTo &&
      this.snapshot.effectiveTo.getTime() <= input.at.getTime()
    ) {
      return false;
    }

    return (
      matchesNullableScope(this.snapshot.dealDirection, input.dealDirection) &&
      matchesNullableScope(this.snapshot.dealForm, input.dealForm) &&
      matchesNullableScope(
        this.snapshot.fromCurrencyId,
        input.fromCurrencyId ?? null,
      ) &&
      matchesNullableScope(
        this.snapshot.toCurrencyId,
        input.toCurrencyId ?? null,
      )
    );
  }

  specificity(): number {
    return [
      this.snapshot.dealDirection,
      this.snapshot.dealForm,
      this.snapshot.fromCurrencyId,
      this.snapshot.toCurrencyId,
    ].filter(Boolean).length;
  }

  comparePrecedence(other: FeeRule): number {
    return (
      this.snapshot.priority - other.snapshot.priority ||
      other.specificity() - this.specificity() ||
      this.snapshot.effectiveFrom.getTime() -
        other.snapshot.effectiveFrom.getTime() ||
      (this.snapshot.createdAt?.getTime() ?? 0) -
        (other.snapshot.createdAt?.getTime() ?? 0) ||
      this.snapshot.id.localeCompare(other.snapshot.id)
    );
  }

  toFeeComponent(input: {
    principalMinor: bigint;
    defaultCurrency: string;
    fixedCurrency?: string;
  }): FeeComponent | null {
    const amountMinor =
      this.snapshot.calcMethod === "bps"
        ? (() => {
            invariant(this.snapshot.bps !== null, "bps fee rule requires bps", {
              code: "treasury.fee_rule.bps_required",
            });
            return calculateBpsAmount(input.principalMinor, this.snapshot.bps);
          })()
        : (this.snapshot.fixedAmountMinor ?? 0n);

    if (amountMinor <= 0n) {
      return null;
    }

    return {
      id: `rule:${this.snapshot.id}`,
      ruleId: this.snapshot.id,
      kind: this.snapshot.feeKind,
      currency:
        this.snapshot.calcMethod === "fixed"
          ? (input.fixedCurrency ?? input.defaultCurrency)
          : input.defaultCurrency,
      amountMinor,
      source: "rule",
      settlementMode: this.snapshot.settlementMode,
      accountingTreatment: this.snapshot.accountingTreatment,
      memo: this.snapshot.memo ?? undefined,
      metadata: this.snapshot.metadata ?? undefined,
    };
  }
}

function matchesNullableScope(
  ruleValue: string | null,
  inputValue: string | null | undefined,
): boolean {
  return ruleValue === null || ruleValue === (inputValue ?? null);
}
