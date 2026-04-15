import { z } from "zod";

import {
  TREASURY_OPERATION_FACT_SOURCE_KIND_VALUES,
  TREASURY_OPERATION_KIND_VALUES,
  TREASURY_OPERATION_STATE_VALUES,
} from "../../domain/operation-types";

export const TreasuryOperationKindSchema = z.enum(
  TREASURY_OPERATION_KIND_VALUES,
);
export type TreasuryOperationKind = z.infer<
  typeof TreasuryOperationKindSchema
>;

export const TreasuryOperationStateSchema = z.enum(
  TREASURY_OPERATION_STATE_VALUES,
);
export type TreasuryOperationState = z.infer<
  typeof TreasuryOperationStateSchema
>;

export const TreasuryOperationFactSourceKindSchema = z.enum(
  TREASURY_OPERATION_FACT_SOURCE_KIND_VALUES,
);
export type TreasuryOperationFactSourceKind = z.infer<
  typeof TreasuryOperationFactSourceKindSchema
>;
