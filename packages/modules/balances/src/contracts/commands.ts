import type { z } from "zod";

import type { CorrelationContext } from "@bedrock/shared/core/correlation";

import type { BalanceHoldSnapshot, BalanceSnapshot } from "./dto";
import type {
  BalanceSubjectSchema,
  ConsumeBalanceInputSchema,
  ReleaseBalanceInputSchema,
  ReserveBalanceInputSchema,
} from "./zod";

export interface BalanceMutationResult {
  balance: BalanceSnapshot;
  hold: BalanceHoldSnapshot | null;
}

export interface ReserveBalanceInput {
  subject: BalanceSubjectInput;
  amount?: string | number | bigint;
  amountMinor?: bigint;
  holdRef: string;
  reason?: string;
  actorId?: string;
  idempotencyKey: string;
  requestContext?: CorrelationContext;
}

export interface ReleaseBalanceInput {
  subject: BalanceSubjectInput;
  holdRef: string;
  reason?: string;
  actorId?: string;
  idempotencyKey: string;
  requestContext?: CorrelationContext;
}

export interface ConsumeBalanceInput {
  subject: BalanceSubjectInput;
  holdRef: string;
  reason?: string;
  actorId?: string;
  idempotencyKey: string;
  requestContext?: CorrelationContext;
}

export type BalanceSubjectInput = z.infer<typeof BalanceSubjectSchema>;
export type ValidatedReserveBalanceInput = z.infer<
  typeof ReserveBalanceInputSchema
>;
export type ValidatedReleaseBalanceInput = z.infer<
  typeof ReleaseBalanceInputSchema
>;
export type ValidatedConsumeBalanceInput = z.infer<
  typeof ConsumeBalanceInputSchema
>;
