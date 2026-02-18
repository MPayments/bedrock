import { and, eq, or, sql } from "drizzle-orm";

import { type Transaction } from "@bedrock/db";
import { schema } from "@bedrock/db/schema";
import { makePlanKey } from "@bedrock/kernel";
import { TransferCodes } from "@bedrock/kernel/constants";
import { PlanType } from "@bedrock/ledger";

import { CurrencyMismatchError, AmountMismatchError, InvalidStateError, NotFoundError, ValidationError } from "../errors";
import { SYSTEM_LEDGER_ORG_ID, type TreasuryServiceContext } from "../internal/context";
import { fetchOrderState } from "../internal/order-state";
import {
    AdvancedOrderStatuses,
    FundingSettledAllowedFrom,
    TreasuryOrderStatus,
    isOrderStatusIn,
} from "../state-machine";
import { type FundingSettledInput, validateFundingSettledInput } from "../validation";

export function createFundingSettledHandler(context: TreasuryServiceContext) {
    const { db, ledger, log, keys, currenciesService } = context;

    return async function fundingSettled(input: FundingSettledInput) {
        const validated = validateFundingSettledInput(input);
        log.debug("fundingSettled start", { orderId: validated.orderId, railRef: validated.railRef });

        return db.transaction(async (tx: Transaction) => {
            const [order] = await tx
                .select()
                .from(schema.paymentOrders)
                .where(eq(schema.paymentOrders.id, validated.orderId))
                .limit(1);

            if (!order) throw new NotFoundError("Order", validated.orderId);
            const { code: payInCurrency } = await currenciesService.findById(order.payInCurrencyId);

            if (validated.currency !== payInCurrency) {
                throw new CurrencyMismatchError("payInCurrency", payInCurrency, validated.currency);
            }

            if (validated.amountMinor !== order.payInExpectedMinor) {
                throw new AmountMismatchError("payInExpectedMinor", order.payInExpectedMinor, validated.amountMinor);
            }

            if (validated.customerId !== order.customerId) {
                throw new ValidationError(`customerId mismatch: expected ${order.customerId}, got ${validated.customerId}`);
            }
            if (validated.branchOrgId !== order.payInOrgId) {
                throw new ValidationError(`branchOrgId mismatch: expected ${order.payInOrgId}, got ${validated.branchOrgId}`);
            }

            const pk = makePlanKey("funding_settled", {
                railRef: validated.railRef,
                orderId: validated.orderId,
                currency: validated.currency,
                amount: validated.amountMinor.toString(),
                branchOrgId: validated.branchOrgId,
                branchBankStableKey: validated.branchBankStableKey,
                customerId: validated.customerId,
            });

            const { entryId } = await ledger.createEntryTx(tx, {
                orgId: SYSTEM_LEDGER_ORG_ID,
                source: { type: "order/funding_settled", id: validated.orderId },
                idempotencyKey: `funding:${validated.railRef}`,
                postingDate: validated.occurredAt,
                transfers: [
                    {
                        type: PlanType.CREATE,
                        planKey: pk,
                        debitKey: keys.bank(validated.branchOrgId, validated.branchBankStableKey, validated.currency),
                        creditKey: keys.customerWallet(validated.customerId, validated.currency),
                        currency: validated.currency,
                        amount: validated.amountMinor,
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
                        eq(schema.paymentOrders.id, validated.orderId),
                        or(
                            eq(schema.paymentOrders.status, FundingSettledAllowedFrom[0]),
                            eq(schema.paymentOrders.status, FundingSettledAllowedFrom[1])
                        )
                    )
                )
                .returning({ id: schema.paymentOrders.id });

            if (moved.length) {
                log.info("fundingSettled ok", { orderId: validated.orderId, entryId });
                return entryId;
            }

            const current = await fetchOrderState(tx, validated.orderId);
            const st = current.status as string;
            const led = current.ledgerEntryId;

            if (isOrderStatusIn(st, AdvancedOrderStatuses)) {
                if (!led) throw new InvalidStateError(`Order in advanced state ${st} but ledgerEntryId missing`);
                if (led !== entryId) {
                    throw new InvalidStateError(
                        `Order advanced with different ledgerEntryId (expected ${entryId}, found ${led})`
                    );
                }
                log.debug("fundingSettled idempotent", { orderId: validated.orderId, status: st });
                return led;
            }

            throw new InvalidStateError(`Cannot apply fundingSettled in state=${st}`);
        });
    };
}
