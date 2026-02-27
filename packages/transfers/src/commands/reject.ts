import { and, eq, sql } from "drizzle-orm";

import type { Transaction } from "@bedrock/db";
import { schema } from "@bedrock/db/schema";
import { NotFoundError, PermissionError } from "@bedrock/kernel/errors";

import type { ActionOptions } from "../contracts";
import { InvalidStateError, MakerCheckerViolationError } from "../errors";
import type { TransfersServiceContext } from "../internal/context";
import {
  type RejectTransferInput,
  validateRejectTransferInput,
} from "../validation";

export function createRejectHandler(context: TransfersServiceContext) {
  const { db, canApprove, log } = context;

  return async function reject(
    input: RejectTransferInput,
    options?: ActionOptions,
  ) {
    const validated = validateRejectTransferInput(input);

    return db.transaction(async (tx: Transaction) => {
      const [transfer] = await tx
        .select()
        .from(schema.transferOrders)
        .where(eq(schema.transferOrders.id, validated.transferId))
        .limit(1);

      if (!transfer) {
        throw new NotFoundError("Transfer", validated.transferId);
      }

      const allowed = await canApprove?.(
        validated.checkerUserId,
        transfer.sourceCounterpartyId,
        transfer.destinationCounterpartyId,
      );
      if (allowed === false) {
        throw new PermissionError("Not allowed to reject transfer");
      }

      if (transfer.status !== "draft") {
        if (transfer.status === "rejected") {
          return transfer.id;
        }
        throw new InvalidStateError(
          `reject allowed only from draft, got ${transfer.status}`,
          transfer.status,
          ["draft"],
        );
      }

      if (
        transfer.makerUserId === validated.checkerUserId &&
        !options?.skipMakerCheckerValidation
      ) {
        throw new MakerCheckerViolationError();
      }

      const updated = await tx
        .update(schema.transferOrders)
        .set({
          status: "rejected",
          checkerUserId: validated.checkerUserId,
          rejectedAt: validated.occurredAt,
          rejectReason: validated.reason,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(schema.transferOrders.id, transfer.id),
            eq(schema.transferOrders.status, "draft"),
          ),
        )
        .returning({ id: schema.transferOrders.id });

      if (!updated.length) {
        const [current] = await tx
          .select({ status: schema.transferOrders.status })
          .from(schema.transferOrders)
          .where(eq(schema.transferOrders.id, transfer.id))
          .limit(1);

        if (current?.status === "rejected") {
          return transfer.id;
        }
        throw new InvalidStateError(
          "Reject race: transfer state changed during transaction",
        );
      }

      log.info("Transfer rejected", {
        transferId: transfer.id,
        checkerUserId: validated.checkerUserId,
      });

      return transfer.id;
    });
  };
}
