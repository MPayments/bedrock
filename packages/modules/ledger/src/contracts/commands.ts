import type { z } from "zod";

import type { OperationIntentSchema } from "./zod";
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

export type OperationIntentInput = z.input<typeof OperationIntentSchema>;
export type ValidatedOperationIntent = z.output<typeof OperationIntentSchema>;

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
