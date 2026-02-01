export enum PlanType {
    CREATE = "create",
    POST_PENDING = "post_pending",
    VOID_PENDING = "void_pending",
}

export type CreatePlan = {
    type: PlanType.CREATE;
    planKey: string;

    debitKey: string;
    creditKey: string;

    currency: string;
    amount: bigint;

    code?: number;

    pending?: {
        timeoutSeconds: number
    };

    chain?: string;

    memo?: string;
};

export type PostPendingPlan = {
    type: PlanType.POST_PENDING;
    planKey: string;

    currency: string;
    pendingId: bigint;

    amount?: bigint;

    code?: number;

    chain?: string;
};

export type VoidPendingPlan = {
    type: PlanType.VOID_PENDING;
    planKey: string;

    currency: string;
    pendingId: bigint;

    code?: number;

    chain?: string;
};

export type TransferPlanLine = CreatePlan | PostPendingPlan | VoidPendingPlan;

export type CreateEntryInput = {
    orgId: string;
    source: {
        type: string;
        id: string
    };
    idempotencyKey: string;
    postingDate: Date;

    transfers: TransferPlanLine[];
};
