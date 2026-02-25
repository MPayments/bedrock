import { and, eq, sql } from "drizzle-orm";

import { OPERATION_CODE } from "@bedrock/accounting";
import { type Transaction } from "@bedrock/db";
import { schema } from "@bedrock/db/schema";
import { makePlanKey } from "@bedrock/kernel";
import { DAY_IN_SECONDS, TransferCodes } from "@bedrock/kernel/constants";
import {
  AmountMismatchError,
  CurrencyMismatchError,
  InvalidStateError,
  NotFoundError,
  ValidationError,
} from "@bedrock/kernel/errors";
import { PlanType } from "@bedrock/ledger";

import {
  SYSTEM_LEDGER_ORG_ID,
  type TreasuryServiceContext,
} from "../internal/context";
import { buildTreasuryOperationInput } from "../internal/ledger-operation";
import { fetchOrderState } from "../internal/order-state";
import {
  InitiatePayoutAllowedFrom,
  ResolvePendingPayoutAllowedFrom,
  TreasuryOrderStatus,
  isOrderStatusIn,
  isSameEntryInAllowedState,
} from "../state-machine";
import {
  type InitiatePayoutInput,
  type SettlePayoutInput,
  type VoidPayoutInput,
  validateInitiatePayoutInput,
  validateSettlePayoutInput,
  validateVoidPayoutInput,
} from "../validation";

export function createPayoutHandlers(context: TreasuryServiceContext) {
  const { db, ledger, log, keys, currenciesService } = context;

  async function initiatePayout(input: InitiatePayoutInput) {
    const validated = validateInitiatePayoutInput(input);
    const timeoutSeconds = validated.timeoutSeconds ?? DAY_IN_SECONDS;
    log.debug("initiatePayout start", {
      orderId: validated.orderId,
      railRef: validated.railRef,
    });

    return db.transaction(async (tx: Transaction) => {
      const [order] = await tx
        .select()
        .from(schema.paymentOrders)
        .where(eq(schema.paymentOrders.id, validated.orderId))
        .limit(1);

      if (!order) throw new NotFoundError("Order", validated.orderId);
      const { code: payOutCurrency } = await currenciesService.findById(
        order.payOutCurrencyId,
      );

      if (validated.payOutCurrency !== payOutCurrency) {
        throw new CurrencyMismatchError(
          "payOutCurrency",
          payOutCurrency,
          validated.payOutCurrency,
        );
      }

      if (validated.amountMinor !== order.payOutAmountMinor) {
        throw new AmountMismatchError(
          "payOutAmountMinor",
          order.payOutAmountMinor,
          validated.amountMinor,
        );
      }
      if (validated.payoutCounterpartyId !== order.payOutCounterpartyId) {
        throw new ValidationError(
          `payoutCounterpartyId mismatch: expected ${order.payOutCounterpartyId}, got ${validated.payoutCounterpartyId}`,
        );
      }

      if (!isOrderStatusIn(order.status, InitiatePayoutAllowedFrom)) {
        throw new InvalidStateError(
          `Order must be ${TreasuryOrderStatus.FX_EXECUTED} (posted), got ${order.status}`,
        );
      }

      const planKey = makePlanKey("payout_init", {
        railRef: validated.railRef,
        orderId: validated.orderId,
        currency: validated.payOutCurrency,
        amount: validated.amountMinor.toString(),
        payoutCounterpartyId: validated.payoutCounterpartyId,
        payoutBankStableKey: validated.payoutBankStableKey,
      });

      const { operationId: entryId, transferIds } =
        await ledger.createOperationTx(
          tx,
          buildTreasuryOperationInput({
            source: { type: "order/payout_initiated", id: validated.orderId },
            operationCode: OPERATION_CODE.TREASURY_PAYOUT_INIT,
            payload: {
              orderId: validated.orderId,
              railRef: validated.railRef,
              amountMinor: validated.amountMinor.toString(),
              payOutCurrency: validated.payOutCurrency,
            },
            idempotencyKey: `payout:init:${validated.railRef}`,
            postingDate: validated.occurredAt,
            bookOrgId: SYSTEM_LEDGER_ORG_ID,
            transfers: [
              {
                type: PlanType.CREATE,
                planKey,
                debitKey: keys.payoutObligation(
                  validated.orderId,
                  validated.payOutCurrency,
                ),
                creditKey: keys.bank(
                  validated.payoutCounterpartyId,
                  validated.payoutBankStableKey,
                  validated.payOutCurrency,
                ),
                currency: validated.payOutCurrency,
                amount: validated.amountMinor,
                code: TransferCodes.PAYOUT_INITIATED,
                pending: {
                  timeoutSeconds,
                },
                memo: "Payout initiated (pending)",
              },
            ],
          }),
        );

      const pendingTransferId = transferIds.get(1)!;

      const moved = await tx
        .update(schema.paymentOrders)
        .set({
          status: TreasuryOrderStatus.PAYOUT_INITIATED_PENDING_POSTING,
          ledgerOperationId: entryId,
          payoutPendingTransferId: pendingTransferId,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(schema.paymentOrders.id, validated.orderId),
            eq(schema.paymentOrders.status, TreasuryOrderStatus.FX_EXECUTED),
          ),
        )
        .returning({ id: schema.paymentOrders.id });

      if (moved.length) {
        log.info("initiatePayout ok", {
          orderId: validated.orderId,
          entryId,
          pendingTransferId,
        });
        return { entryId, pendingTransferId };
      }

      const current = await fetchOrderState(tx, validated.orderId);
      const st = current.status;

      if (
        isSameEntryInAllowedState(
          st as string,
          current.ledgerOperationId,
          entryId,
          [
            TreasuryOrderStatus.PAYOUT_INITIATED_PENDING_POSTING,
            TreasuryOrderStatus.PAYOUT_INITIATED,
          ],
        )
      ) {
        if (!current.payoutPendingTransferId) {
          throw new InvalidStateError(
            `Order in state ${st} but payoutPendingTransferId missing`,
          );
        }
        log.debug("initiatePayout idempotent", {
          orderId: validated.orderId,
          status: st,
        });
        return { entryId, pendingTransferId: current.payoutPendingTransferId };
      }

      throw new InvalidStateError(
        `Failed to update order status: concurrent modification detected. Current status: ${st}`,
      );
    });
  }

  async function settlePayout(input: SettlePayoutInput) {
    const validated = validateSettlePayoutInput(input);
    log.debug("settlePayout start", {
      orderId: validated.orderId,
      railRef: validated.railRef,
    });

    return db.transaction(async (tx: Transaction) => {
      const [order] = await tx
        .select()
        .from(schema.paymentOrders)
        .where(eq(schema.paymentOrders.id, validated.orderId))
        .limit(1);

      if (!order) throw new NotFoundError("Order", validated.orderId);
      const { code: payOutCurrency } = await currenciesService.findById(
        order.payOutCurrencyId,
      );

      if (validated.payOutCurrency !== payOutCurrency) {
        throw new CurrencyMismatchError(
          "payOutCurrency",
          payOutCurrency,
          validated.payOutCurrency,
        );
      }

      if (!isOrderStatusIn(order.status, ResolvePendingPayoutAllowedFrom)) {
        throw new InvalidStateError(
          `Order must be ${TreasuryOrderStatus.PAYOUT_INITIATED} (posted), got ${order.status}`,
        );
      }
      if (!order.payoutPendingTransferId)
        throw new InvalidStateError(
          "Missing payoutPendingTransferId - order state is inconsistent",
        );

      const planKey = makePlanKey("payout_settle", {
        railRef: validated.railRef,
        orderId: validated.orderId,
        currency: validated.payOutCurrency,
        pendingId: order.payoutPendingTransferId.toString(),
      });

      const { operationId: entryId } = await ledger.createOperationTx(
        tx,
        buildTreasuryOperationInput({
          source: { type: "order/payout_settled", id: validated.orderId },
          operationCode: OPERATION_CODE.TREASURY_PAYOUT_SETTLE,
          payload: {
            orderId: validated.orderId,
            railRef: validated.railRef,
            pendingTransferId: order.payoutPendingTransferId.toString(),
            payOutCurrency: validated.payOutCurrency,
          },
          idempotencyKey: `payout:settle:${validated.railRef}`,
          postingDate: validated.occurredAt,
          bookOrgId: SYSTEM_LEDGER_ORG_ID,
          transfers: [
            {
              type: PlanType.POST_PENDING,
              planKey,
              currency: validated.payOutCurrency,
              pendingId: order.payoutPendingTransferId,
              amount: 0n,
            },
          ],
        }),
      );

      const moved = await tx
        .update(schema.paymentOrders)
        .set({
          status: TreasuryOrderStatus.CLOSED_PENDING_POSTING,
          ledgerOperationId: entryId,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(schema.paymentOrders.id, validated.orderId),
            eq(
              schema.paymentOrders.status,
              TreasuryOrderStatus.PAYOUT_INITIATED,
            ),
          ),
        )
        .returning({ id: schema.paymentOrders.id });

      if (moved.length) {
        log.info("settlePayout ok", { orderId: validated.orderId, entryId });
        return entryId;
      }

      const current = await fetchOrderState(tx, validated.orderId);
      const st = current.status;

      if (
        isSameEntryInAllowedState(
          st as string,
          current.ledgerOperationId,
          entryId,
          [
            TreasuryOrderStatus.CLOSED_PENDING_POSTING,
            TreasuryOrderStatus.CLOSED,
          ],
        )
      ) {
        log.debug("settlePayout idempotent", {
          orderId: validated.orderId,
          status: st,
        });
        return entryId;
      }

      throw new InvalidStateError(
        `Failed to update order status: concurrent modification detected. Current status: ${st}`,
      );
    });
  }

  async function voidPayout(input: VoidPayoutInput) {
    const validated = validateVoidPayoutInput(input);
    log.debug("voidPayout start", {
      orderId: validated.orderId,
      railRef: validated.railRef,
    });

    return db.transaction(async (tx: Transaction) => {
      const [order] = await tx
        .select()
        .from(schema.paymentOrders)
        .where(eq(schema.paymentOrders.id, validated.orderId))
        .limit(1);

      if (!order) throw new NotFoundError("Order", validated.orderId);
      const { code: payOutCurrency } = await currenciesService.findById(
        order.payOutCurrencyId,
      );

      if (validated.payOutCurrency !== payOutCurrency) {
        throw new CurrencyMismatchError(
          "payOutCurrency",
          payOutCurrency,
          validated.payOutCurrency,
        );
      }

      if (!isOrderStatusIn(order.status, ResolvePendingPayoutAllowedFrom)) {
        throw new InvalidStateError(
          `Order must be ${TreasuryOrderStatus.PAYOUT_INITIATED} (posted), got ${order.status}`,
        );
      }
      if (!order.payoutPendingTransferId)
        throw new InvalidStateError(
          "Missing payoutPendingTransferId - order state is inconsistent",
        );

      const planKey = makePlanKey("payout_void", {
        railRef: validated.railRef,
        orderId: validated.orderId,
        currency: validated.payOutCurrency,
        pendingId: order.payoutPendingTransferId.toString(),
      });

      const { operationId: entryId } = await ledger.createOperationTx(
        tx,
        buildTreasuryOperationInput({
          source: { type: "order/payout_failed", id: validated.orderId },
          operationCode: OPERATION_CODE.TREASURY_PAYOUT_VOID,
          payload: {
            orderId: validated.orderId,
            railRef: validated.railRef,
            pendingTransferId: order.payoutPendingTransferId.toString(),
            payOutCurrency: validated.payOutCurrency,
          },
          idempotencyKey: `payout:void:${validated.railRef}`,
          postingDate: validated.occurredAt,
          bookOrgId: SYSTEM_LEDGER_ORG_ID,
          transfers: [
            {
              type: PlanType.VOID_PENDING,
              planKey,
              currency: validated.payOutCurrency,
              pendingId: order.payoutPendingTransferId,
            },
          ],
        }),
      );

      const moved = await tx
        .update(schema.paymentOrders)
        .set({
          status: TreasuryOrderStatus.FAILED_PENDING_POSTING,
          ledgerOperationId: entryId,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(schema.paymentOrders.id, validated.orderId),
            eq(
              schema.paymentOrders.status,
              TreasuryOrderStatus.PAYOUT_INITIATED,
            ),
          ),
        )
        .returning({ id: schema.paymentOrders.id });

      if (moved.length) {
        log.info("voidPayout ok", { orderId: validated.orderId, entryId });
        return entryId;
      }

      const current = await fetchOrderState(tx, validated.orderId);
      const st = current.status;

      if (
        isSameEntryInAllowedState(
          st as string,
          current.ledgerOperationId,
          entryId,
          [
            TreasuryOrderStatus.FAILED_PENDING_POSTING,
            TreasuryOrderStatus.FAILED,
          ],
        )
      ) {
        log.debug("voidPayout idempotent", {
          orderId: validated.orderId,
          status: st,
        });
        return entryId;
      }

      throw new InvalidStateError(
        `Failed to update order status: concurrent modification detected. Current status: ${st}`,
      );
    });
  }

  return {
    initiatePayout,
    settlePayout,
    voidPayout,
  };
}
