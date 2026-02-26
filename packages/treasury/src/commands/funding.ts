import { and, eq, or, sql } from "drizzle-orm";

import { ACCOUNT_NO, OPERATION_CODE, POSTING_CODE } from "@bedrock/accounting";
import { type Transaction } from "@bedrock/db";
import { schema } from "@bedrock/db/schema";
import { makePlanKey } from "@bedrock/kernel";
import { TransferCodes } from "@bedrock/kernel/constants";
import { OPERATION_TRANSFER_TYPE } from "@bedrock/ledger";

import {
  CurrencyMismatchError,
  AmountMismatchError,
  InvalidStateError,
  NotFoundError,
  ValidationError,
} from "../errors";
import {
  SYSTEM_LEDGER_ORG_ID,
  type TreasuryServiceContext,
} from "../internal/context";
import { buildTreasuryOperationInput } from "../internal/ledger-operation";
import { fetchOrderState } from "../internal/order-state";
import {
  AdvancedOrderStatuses,
  FundingSettledAllowedFrom,
  TreasuryOrderStatus,
  isOrderStatusIn,
} from "../state-machine";
import {
  type FundingSettledInput,
  validateFundingSettledInput,
} from "../validation";

export function createFundingSettledHandler(context: TreasuryServiceContext) {
  const { db, ledger, log, currenciesService } = context;

  return async function fundingSettled(input: FundingSettledInput) {
    const validated = validateFundingSettledInput(input);
    log.debug("fundingSettled start", {
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
      const { code: payInCurrency } = await currenciesService.findById(
        order.payInCurrencyId,
      );

      if (validated.currency !== payInCurrency) {
        throw new CurrencyMismatchError(
          "payInCurrency",
          payInCurrency,
          validated.currency,
        );
      }

      if (validated.amountMinor !== order.payInExpectedMinor) {
        throw new AmountMismatchError(
          "payInExpectedMinor",
          order.payInExpectedMinor,
          validated.amountMinor,
        );
      }

      if (validated.customerId !== order.customerId) {
        throw new ValidationError(
          `customerId mismatch: expected ${order.customerId}, got ${validated.customerId}`,
        );
      }
      if (validated.branchCounterpartyId !== order.payInCounterpartyId) {
        throw new ValidationError(
          `branchCounterpartyId mismatch: expected ${order.payInCounterpartyId}, got ${validated.branchCounterpartyId}`,
        );
      }
      const payInOperationalAccountId = order.payInAccountId;
      if (!payInOperationalAccountId) {
        throw new ValidationError(
          `Order ${order.id} is missing payIn operational account id`,
        );
      }

      const pk = makePlanKey("funding_settled", {
        railRef: validated.railRef,
        orderId: validated.orderId,
        currency: validated.currency,
        amount: validated.amountMinor.toString(),
        branchCounterpartyId: validated.branchCounterpartyId,
        branchBankStableKey: validated.branchBankStableKey,
        customerId: validated.customerId,
      });

      const { operationId: entryId } = await ledger.createOperationTx(
        tx,
        buildTreasuryOperationInput({
          source: { type: "order/funding_settled", id: validated.orderId },
          operationCode: OPERATION_CODE.TREASURY_FUNDING_SETTLED,
          payload: {
            orderId: validated.orderId,
            railRef: validated.railRef,
            amountMinor: validated.amountMinor.toString(),
            currency: validated.currency,
          },
          idempotencyKey: `funding:${validated.railRef}`,
          postingDate: validated.occurredAt,
          bookOrgId: SYSTEM_LEDGER_ORG_ID,
          transfers: [
            {
              type: OPERATION_TRANSFER_TYPE.CREATE,
              planKey: pk,
              postingCode: POSTING_CODE.FUNDING_SETTLED,
              debitAccountNo: ACCOUNT_NO.BANK,
              creditAccountNo: ACCOUNT_NO.CUSTOMER_WALLET,
              currency: validated.currency,
              amount: validated.amountMinor,
              code: TransferCodes.FUNDING_SETTLED,
              memo: "Funding settled",
              analytics: {
                counterpartyId: validated.branchCounterpartyId,
                customerId: validated.customerId,
                orderId: validated.orderId,
                operationalAccountId: payInOperationalAccountId,
              },
            },
          ],
        }),
      );

      const moved = await tx
        .update(schema.paymentOrders)
        .set({
          status: TreasuryOrderStatus.FUNDING_SETTLED_PENDING_POSTING,
          ledgerOperationId: entryId,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(schema.paymentOrders.id, validated.orderId),
            or(
              eq(schema.paymentOrders.status, FundingSettledAllowedFrom[0]),
              eq(schema.paymentOrders.status, FundingSettledAllowedFrom[1]),
            ),
          ),
        )
        .returning({ id: schema.paymentOrders.id });

      if (moved.length) {
        log.info("fundingSettled ok", { orderId: validated.orderId, entryId });
        return entryId;
      }

      const current = await fetchOrderState(tx, validated.orderId);
      const st = current.status as string;
      const led = current.ledgerOperationId;

      if (isOrderStatusIn(st, AdvancedOrderStatuses)) {
        if (!led) {
          throw new InvalidStateError(
            `Order in advanced state ${st} but ledgerOperationId missing`,
          );
        }
        if (led !== entryId) {
          throw new InvalidStateError(
            `Order advanced with different ledgerOperationId (expected ${entryId}, found ${led})`,
          );
        }
        log.debug("fundingSettled idempotent", {
          orderId: validated.orderId,
          status: st,
        });
        return led;
      }

      throw new InvalidStateError(`Cannot apply fundingSettled in state=${st}`);
    });
  };
}
