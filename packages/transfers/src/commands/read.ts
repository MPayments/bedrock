import { NotFoundError } from "@bedrock/kernel/errors";
import { type PaginatedList } from "@bedrock/kernel/pagination";

import type { TransfersServiceContext } from "../internal/context";
import {
  getTransferProjection,
  listTransferProjections,
  type TransferOrderProjection,
} from "../internal/shared";
import {
  ListTransfersQuerySchema,
  type ListTransfersQuery,
} from "../validation";

export function createReadHandlers(context: TransfersServiceContext) {
  const { db } = context;

  async function get(transferId: string): Promise<TransferOrderProjection> {
    const transfer = await getTransferProjection(db, transferId);
    if (!transfer) {
      throw new NotFoundError("Transfer", transferId);
    }
    return transfer;
  }

  async function list(
    input?: ListTransfersQuery,
  ): Promise<PaginatedList<TransferOrderProjection>> {
    const query = ListTransfersQuerySchema.parse(input ?? {});
    return listTransferProjections(db, {
      limit: query.limit,
      offset: query.offset,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      sourceCounterpartyId: query.sourceCounterpartyId,
      destinationCounterpartyId: query.destinationCounterpartyId,
      status: query.status,
      settlementMode: query.settlementMode,
      kind: query.kind,
    });
  }

  return { get, list };
}
