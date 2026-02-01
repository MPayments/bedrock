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

    chain?: string | null;

    memo?: string | null;
};

export type PostPendingPlan = {
    type: PlanType.POST_PENDING;
    planKey: string;

    currency: string;
    pendingId: bigint;

    amount?: bigint;

    code?: number;

    chain?: string | null;

    memo?: string | null;
};

export type VoidPendingPlan = {
    type: PlanType.VOID_PENDING;
    planKey: string;

    currency: string;
    pendingId: bigint;

    code?: number;

    chain?: string | null;

    memo?: string | null;
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

/**
 * Result of creating a journal entry.
 * 
 * Includes the entry ID and a map of transfer IDs by plan index (1-based).
 * This allows callers to get the deterministic transfer IDs without needing
 * to know the internal ID generation scheme.
 */
export type CreateEntryResult = {
    /** The journal entry ID */
    entryId: string;
    
    /** 
     * Map from plan index (1-based) to the deterministic transfer ID.
     * Use this to get transfer IDs for pending transfers that need to be
     * referenced later (e.g., for post_pending or void_pending operations).
     */
    transferIds: Map<number, bigint>;
};
