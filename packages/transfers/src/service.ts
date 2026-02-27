import { createApproveHandler } from "./commands/approve";
import { createCreateDraftHandler } from "./commands/create-draft";
import { createPendingHandlers } from "./commands/pending";
import { createReadHandlers } from "./commands/read";
import { createRejectHandler } from "./commands/reject";
import type { ActionOptions, TransfersServiceResult } from "./contracts";
import {
  createTransfersServiceContext,
  type TransfersServiceDeps,
} from "./internal/context";

export type { ActionOptions, TransfersServiceResult };
export type TransfersService = ReturnType<typeof createTransfersService>;

export function createTransfersService(deps: TransfersServiceDeps) {
  const context = createTransfersServiceContext(deps);

  const createDraft = createCreateDraftHandler(context);
  const approve = createApproveHandler(context);
  const reject = createRejectHandler(context);
  const pendingHandlers = createPendingHandlers(context);
  const readHandlers = createReadHandlers(context);

  return {
    createDraft,
    approve,
    reject,
    ...pendingHandlers,
    ...readHandlers,
  };
}
