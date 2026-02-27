import { sql } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";
import { DAY_IN_SECONDS } from "@bedrock/kernel/constants";

import { InvalidStateError } from "../errors";
import type { TransfersServiceContext } from "../internal/context";
import { createResolveTransferBindings } from "../internal/shared";
import {
  type CreateTransferDraftInput,
  validateCreateTransferDraftInput,
} from "../validation";

export function createCreateDraftHandler(context: TransfersServiceContext) {
  const { db, log } = context;
  const resolveTransferBindings = createResolveTransferBindings(context);

  return async function createDraft(input: CreateTransferDraftInput) {
    const validated = validateCreateTransferDraftInput(input);
    const [sourceBinding, destinationBinding] = await resolveTransferBindings(
      validated.sourceOperationalAccountId,
      validated.destinationOperationalAccountId,
    );

    const kind: typeof schema.transferOrders.$inferInsert.kind =
      sourceBinding.counterpartyId === destinationBinding.counterpartyId
        ? "intra_org"
        : "cross_org";
    const settlementMode = validated.settlementMode ?? "immediate";
    const timeoutSeconds =
      settlementMode === "pending"
        ? (validated.timeoutSeconds ?? DAY_IN_SECONDS)
        : 0;

    const [upserted] = await db
      .insert(schema.transferOrders)
      .values({
        sourceCounterpartyId: sourceBinding.counterpartyId,
        destinationCounterpartyId: destinationBinding.counterpartyId,
        sourceOperationalAccountId: sourceBinding.accountId,
        destinationOperationalAccountId: destinationBinding.accountId,
        currencyId: sourceBinding.currencyId,
        amountMinor: validated.amountMinor,
        kind,
        settlementMode,
        timeoutSeconds,
        status: "draft",
        memo: validated.memo ?? null,
        makerUserId: validated.makerUserId,
        idempotencyKey: validated.idempotencyKey,
      })
      .onConflictDoUpdate({
        target: [
          schema.transferOrders.sourceCounterpartyId,
          schema.transferOrders.idempotencyKey,
        ],
        set: {
          updatedAt: sql`now()`,
        },
      })
      .returning({
        id: schema.transferOrders.id,
        sourceOperationalAccountId:
          schema.transferOrders.sourceOperationalAccountId,
        destinationOperationalAccountId:
          schema.transferOrders.destinationOperationalAccountId,
        currencyId: schema.transferOrders.currencyId,
        amountMinor: schema.transferOrders.amountMinor,
        kind: schema.transferOrders.kind,
        settlementMode: schema.transferOrders.settlementMode,
        timeoutSeconds: schema.transferOrders.timeoutSeconds,
        memo: schema.transferOrders.memo,
        makerUserId: schema.transferOrders.makerUserId,
      });

    if (!upserted) {
      throw new InvalidStateError("Draft upsert failed unexpectedly");
    }

    const memo = validated.memo ?? null;
    const isSameDraftPayload =
      upserted.sourceOperationalAccountId === sourceBinding.accountId &&
      upserted.destinationOperationalAccountId ===
        destinationBinding.accountId &&
      upserted.currencyId === sourceBinding.currencyId &&
      upserted.amountMinor === validated.amountMinor &&
      upserted.kind === kind &&
      upserted.settlementMode === settlementMode &&
      upserted.timeoutSeconds === timeoutSeconds &&
      upserted.memo === memo &&
      upserted.makerUserId === validated.makerUserId;

    if (!isSameDraftPayload) {
      throw new InvalidStateError(
        `Draft idempotency conflict: key=${validated.idempotencyKey} is already used with different payload`,
      );
    }

    log.debug("Transfer draft already exists (idempotent)", {
      transferId: upserted.id,
      idempotencyKey: validated.idempotencyKey,
    });
    return upserted.id;
  };
}
