/**
 * Account reference types - business-level identifiers for ledger accounts.
 */
export type AccountRef =
  | { kind: "customer"; customerId: string; currency: string }
  | { kind: "internal"; name: string; currency: string }
  | { kind: "global_ledger"; code: string; currency: string };

/** URL-encode component to avoid delimiter collision with `:` */
const enc = (s: string) => encodeURIComponent(s);

/** Stable key for mapping table primary key. Components are URL-encoded to prevent `:` collisions. */
export function accountRefKey(ref: AccountRef): string {
  switch (ref.kind) {
    case "customer":
      return `customer:${enc(ref.customerId)}:${enc(ref.currency)}`;
    case "internal":
      return `internal:${enc(ref.name)}:${enc(ref.currency)}`;
    case "global_ledger":
      return `gl:${enc(ref.code)}:${enc(ref.currency)}`;
  }
}

export type PostMode = "single" | "linked_chain";

export interface PostTransferInput {
  id: bigint;                 // required (batch semantics + idempotency)
  debit: AccountRef;
  credit: AccountRef;
  amount: bigint;
  code: number;               // required (matches old)
  metadata?: string;          // optional, not used by TB yet
}

export interface PostRequest {
  mode: PostMode;
  transfers: PostTransferInput[];
}

export interface ResolvedAccount {
  ref: AccountRef;
  tbAccountId: bigint;
  tbLedger: number;
}

export interface PostReceipt {
  submitted: Array<{
    id: bigint;
    debit: ResolvedAccount;
    credit: ResolvedAccount;
    amount: bigint;
    code: number;
  }>;
  transferIds: bigint[];
}

/** Single transfer API (convenience) */
export interface TransferInput {
  id?: bigint;                // optional, service can generate
  debit: AccountRef;
  credit: AccountRef;
  amount: bigint;
  code: number;
  metadata?: string;
}

export interface AccountBalance {
  ref: AccountRef;
  tbAccountId: bigint;
  debitsPosted: bigint;
  creditsPosted: bigint;
  debitsPending: bigint;
  creditsPending: bigint;
}
