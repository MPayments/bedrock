import { and, eq, or, sql } from "drizzle-orm";
import { makePlanKey } from "@bedrock/kernel";
import { schema } from "@bedrock/db/schema";
import { PlanType } from "@bedrock/ledger";
import { TransferCodes } from "@bedrock/kernel/constants";

import { CurrencyMismatchError, AmountMismatchError, InvalidStateError, NotFoundError, ValidationError } from "../errors";
import { type FundingSettledInput, validateFundingSettledInput } from "../validation";
import {
    AdvancedOrderStatuses,
    FundingSettledAllowedFrom,
    TreasuryOrderStatus,
    isOrderStatusIn,
} from "../state-machine";
import { SYSTEM_LEDGER_ORG_ID, type TreasuryServiceContext } from "../internal/context";
import { fetchOrderState } from "../internal/order-state";

export function createFundingSettledHandler(context: TreasuryServiceContext) {
    const { db, ledger, log, keys } = context;

    return async function fundingSettled(rawInput: FundingSettledInput) {
        const input = validateFundingSettledInput(rawInput);
        log.debug("fundingSettled start", { orderId: input.orderId, railRef: input.railRef });

        return db.transaction(async (tx: any) => {
            const [order] = await tx
                .select()
                .from(schema.paymentOrders)
                .where(eq(schema.paymentOrders.id, input.orderId))
                .limit(1);

            if (!order) throw new NotFoundError("Order", input.orderId);

            if (input.currency !== order.payInCurrency) {
                throw new CurrencyMismatchError("payInCurrency", order.payInCurrency, input.currency);
            }

            if (input.amountMinor !== order.payInExpectedMinor) {
                throw new AmountMismatchError("payInExpectedMinor", order.payInExpectedMinor, input.amountMinor);
            }

            if (input.customerId !== order.customerId) {
                throw new ValidationError(`customerId mismatch: expected ${order.customerId}, got ${input.customerId}`);
            }
            if (input.branchOrgId !== order.payInOrgId) {
                throw new ValidationError(`branchOrgId mismatch: expected ${order.payInOrgId}, got ${input.branchOrgId}`);
            }

            const pk = makePlanKey("funding_settled", {
                railRef: input.railRef,
                orderId: input.orderId,
                currency: input.currency,
                amount: input.amountMinor.toString(),
                branchOrgId: input.branchOrgId,
                branchBankStableKey: input.branchBankStableKey,
                customerId: input.customerId,
            });

            const { entryId } = await ledger.createEntryTx(tx, {
                orgId: SYSTEM_LEDGER_ORG_ID,
                source: { type: "order/funding_settled", id: input.orderId },
                idempotencyKey: `funding:${input.railRef}`,
                postingDate: input.occurredAt,
                transfers: [
                    {
                        type: PlanType.CREATE,
                        planKey: pk,
                        debitKey: keys.bank(input.branchOrgId, input.branchBankStableKey, input.currency),
                        creditKey: keys.customerWallet(input.customerId, input.currency),
                        currency: input.currency,
                        amount: input.amountMinor,
                        code: TransferCodes.FUNDING_SETTLED,
                        memo: "Funding settled",
                    },
                ],
            });

            const moved = await tx
                .update(schema.paymentOrders)
                .set({
                    status: TreasuryOrderStatus.FUNDING_SETTLED_PENDING_POSTING,
                    ledgerEntryId: entryId,
                    updatedAt: sql`now()`,
                })
                .where(
                    and(
                        eq(schema.paymentOrders.id, input.orderId),
                        or(
                            eq(schema.paymentOrders.status, FundingSettledAllowedFrom[0]),
                            eq(schema.paymentOrders.status, FundingSettledAllowedFrom[1])
                        )
                    )
                )
                .returning({ id: schema.paymentOrders.id });

            if (moved.length) {
                log.info("fundingSettled ok", { orderId: input.orderId, entryId });
                return entryId;
            }

            const current = await fetchOrderState(tx, input.orderId);
            const st = current.status as string;
            const led = current.ledgerEntryId;

            if (isOrderStatusIn(st, AdvancedOrderStatuses)) {
                if (!led) throw new InvalidStateError(`Order in advanced state ${st} but ledgerEntryId missing`);
                if (led !== entryId) {
                    throw new InvalidStateError(
                        `Order advanced with different ledgerEntryId (expected ${entryId}, found ${led})`
                    );
                }
                log.debug("fundingSettled idempotent", { orderId: input.orderId, status: st });
                return led;
            }

            throw new InvalidStateError(`Cannot apply fundingSettled in state=${st}`);
        });
    };
}
