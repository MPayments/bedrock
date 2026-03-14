import type { z } from "zod";

import { OperationIntentSchema } from "./zod";
import type {
  CommitResult,
  CreateIntentLine,
  IntentLine,
  OperationIntent,
  OperationTransferType,
  PostPendingIntentLine,
  VoidPendingIntentLine,
} from "../domain/operation-intent";
import { OPERATION_TRANSFER_TYPE } from "../domain/operation-intent";

type ValidatedOperationIntent = z.infer<typeof OperationIntentSchema>;

export function validateOperationIntent(
  input: unknown,
): ValidatedOperationIntent {
  return OperationIntentSchema.parse(input);
}

export { OPERATION_TRANSFER_TYPE };
export type {
  CommitResult,
  CreateIntentLine,
  IntentLine,
  OperationIntent,
  OperationTransferType,
  PostPendingIntentLine,
  VoidPendingIntentLine,
};
