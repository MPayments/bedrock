import type { PersistenceSession } from "@bedrock/shared/core/persistence";

import type {
  PaymentStepPurpose,
  PaymentStepRecord,
  PaymentStepState,
} from "../../domain/types";

export interface PaymentStepsListQuery {
  batchId?: string;
  createdFrom?: Date;
  createdTo?: Date;
  dealId?: string;
  limit: number;
  offset: number;
  purpose?: PaymentStepPurpose;
  state?: PaymentStepState[];
}

export interface PaymentStepsRepository {
  findStepById(
    id: string,
    tx?: PersistenceSession,
  ): Promise<PaymentStepRecord | undefined>;
  insertStep(
    input: PaymentStepRecord,
    tx?: PersistenceSession,
  ): Promise<PaymentStepRecord | null>;
  listSteps(
    input: PaymentStepsListQuery,
    tx?: PersistenceSession,
  ): Promise<{ rows: PaymentStepRecord[]; total: number }>;
  updateStep(
    input: PaymentStepRecord,
    tx?: PersistenceSession,
  ): Promise<PaymentStepRecord | undefined>;
}
