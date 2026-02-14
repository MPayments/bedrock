export type FeeDealDirection =
    | "cash_to_wire"
    | "wire_to_cash"
    | "wire_to_wire"
    | "usdt_to_cash"
    | "cash_to_usdt"
    | "other";

export type FeeDealForm = "conversion" | "transit";

export type FeeOperationKind =
    | "fx_quote"
    | "fx_execution"
    | "funding"
    | "payout"
    | "internal_transfer"
    | "external_transfer"
    | "custom";

export type FeeCalcMethod = "bps" | "fixed";

export type FeeComponentKind =
    | "fx_fee"
    | "fx_spread"
    | "bank_fee"
    | "blockchain_fee"
    | "manual_fee"
    | (string & {});

export type FeeSource = "policy" | "manual";

export type FeeSettlementMode = "in_ledger" | "separate_payment_order";

export type AdjustmentKind =
    | "late_penalty"
    | "discount"
    | "manual_adjustment"
    | (string & {});

export type AdjustmentEffect = "increase_charge" | "decrease_charge";

export type AdjustmentSource = "manual" | "policy";

export type AdjustmentSettlementMode = FeeSettlementMode;

export type FeeComponent = {
    id: string;
    ruleId?: string;
    kind: FeeComponentKind;
    currency: string;
    amountMinor: bigint;
    source: FeeSource;
    settlementMode?: FeeSettlementMode;
    debitAccountKey?: string;
    creditAccountKey?: string;
    transferCode?: number;
    memo?: string;
    metadata?: Record<string, string>;
};

export type AdjustmentComponent = {
    id: string;
    kind: AdjustmentKind;
    effect: AdjustmentEffect;
    currency: string;
    amountMinor: bigint;
    source: AdjustmentSource;
    settlementMode?: AdjustmentSettlementMode;
    debitAccountKey?: string;
    creditAccountKey?: string;
    transferCode?: number;
    memo?: string;
    metadata?: Record<string, string>;
};

export type CalculateFxQuoteFeeComponentsInput = {
    fromCurrency: string;
    toCurrency: string;
    principalMinor: bigint;
    at: Date;
    dealDirection?: FeeDealDirection;
    dealForm?: FeeDealForm;
};

export type UpsertFeeRuleInput = {
    name: string;
    operationKind: FeeOperationKind;
    feeKind: FeeComponentKind;
    calcMethod: FeeCalcMethod;
    bps?: number;
    fixedAmountMinor?: bigint;
    fixedCurrency?: string;
    settlementMode?: FeeSettlementMode;
    dealDirection?: FeeDealDirection;
    dealForm?: FeeDealForm;
    fromCurrency?: string;
    toCurrency?: string;
    priority?: number;
    isActive?: boolean;
    effectiveFrom?: Date;
    effectiveTo?: Date;
    debitAccountKey?: string;
    creditAccountKey?: string;
    transferCode?: number;
    memo?: string;
    metadata?: Record<string, string>;
};

export type ResolveFeeRulesInput = {
    operationKind: FeeOperationKind;
    at: Date;
    fromCurrency?: string;
    toCurrency?: string;
    dealDirection?: FeeDealDirection;
    dealForm?: FeeDealForm;
};

export type MergeFeeComponentsInput = {
    computed?: FeeComponent[];
    manual?: FeeComponent[];
    aggregate?: boolean;
};

export type MergeAdjustmentComponentsInput = {
    computed?: AdjustmentComponent[];
    manual?: AdjustmentComponent[];
    aggregate?: boolean;
};

export type PartitionedFeeComponents = {
    inLedger: FeeComponent[];
    separatePaymentOrder: FeeComponent[];
};

export type PartitionedAdjustmentComponents = {
    inLedger: AdjustmentComponent[];
    separatePaymentOrder: AdjustmentComponent[];
};

export type BuildFeeTransferPlanInput = {
    components: FeeComponent[];
    chain?: string | null;
    includeZeroAmounts?: boolean;
    makePlanKey?: (component: FeeComponent, idx: number) => string;
    resolvePosting: (
        component: FeeComponent,
        idx: number
    ) => {
        debitKey?: string;
        creditKey?: string;
        code?: number;
        memo?: string | null;
    };
};

export type FeeTransferPlan = {
    planKey: string;
    debitKey: string;
    creditKey: string;
    currency: string;
    amount: bigint;
    code?: number;
    chain?: string | null;
    memo?: string | null;
    component: FeeComponent;
};

export type BuildAdjustmentTransferPlanInput = {
    components: AdjustmentComponent[];
    chain?: string | null;
    includeZeroAmounts?: boolean;
    makePlanKey?: (component: AdjustmentComponent, idx: number) => string;
    resolvePosting: (
        component: AdjustmentComponent,
        idx: number
    ) => {
        debitKey?: string;
        creditKey?: string;
        code?: number;
        memo?: string | null;
    };
};

export type AdjustmentTransferPlan = {
    planKey: string;
    debitKey: string;
    creditKey: string;
    currency: string;
    amount: bigint;
    code?: number;
    chain?: string | null;
    memo?: string | null;
    component: AdjustmentComponent;
};

export type SaveQuoteFeeComponentsInput = {
    quoteId: string;
    components: FeeComponent[];
};

export type GetQuoteFeeComponentsInput = {
    quoteId: string;
};

export type FeeComponentDefaults = {
    bucket: string;
    transferCode: number;
    memo: string;
};

export interface FeesService {
    calculateBpsAmount(amountMinor: bigint, bps: number): bigint;
    getComponentDefaults(kind: string): FeeComponentDefaults;
    upsertRule(input: UpsertFeeRuleInput): Promise<string>;
    listApplicableRules(input: ResolveFeeRulesInput, tx?: any): Promise<unknown[]>;
    calculateFxQuoteFeeComponents(input: CalculateFxQuoteFeeComponentsInput, tx?: any): Promise<FeeComponent[]>;
    saveQuoteFeeComponents(input: SaveQuoteFeeComponentsInput, tx?: any): Promise<void>;
    getQuoteFeeComponents(input: GetQuoteFeeComponentsInput, tx?: any): Promise<FeeComponent[]>;
    mergeFeeComponents(input: MergeFeeComponentsInput): FeeComponent[];
    aggregateFeeComponents(components: FeeComponent[]): FeeComponent[];
    partitionFeeComponents(components: FeeComponent[]): PartitionedFeeComponents;
    buildFeeTransferPlans(input: BuildFeeTransferPlanInput): FeeTransferPlan[];

    mergeAdjustmentComponents(input: MergeAdjustmentComponentsInput): AdjustmentComponent[];
    aggregateAdjustmentComponents(components: AdjustmentComponent[]): AdjustmentComponent[];
    partitionAdjustmentComponents(components: AdjustmentComponent[]): PartitionedAdjustmentComponents;
    buildAdjustmentTransferPlans(input: BuildAdjustmentTransferPlanInput): AdjustmentTransferPlan[];
}
