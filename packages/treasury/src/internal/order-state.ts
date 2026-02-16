import { eq } from "drizzle-orm";
import { type Transaction } from "@bedrock/db";
import { schema } from "@bedrock/db/schema";
import { type FeePaymentOrder, type PaymentOrder } from "@bedrock/db/schema";

import { NotFoundError } from "../errors";

type OrderState = Pick<
    PaymentOrder,
    "id" | "status" | "ledgerEntryId" | "payoutPendingTransferId"
>;

export async function fetchOrderState(tx: Transaction, orderId: string): Promise<OrderState> {
    const [row] = await tx
        .select({
            id: schema.paymentOrders.id,
            status: schema.paymentOrders.status,
            ledgerEntryId: schema.paymentOrders.ledgerEntryId,
            payoutPendingTransferId: schema.paymentOrders.payoutPendingTransferId,
        })
        .from(schema.paymentOrders)
        .where(eq(schema.paymentOrders.id, orderId))
        .limit(1);

    if (!row) throw new NotFoundError("Order", orderId);
    return row;
}

export async function fetchFeePaymentOrderState(
    tx: Transaction,
    feePaymentOrderId: string
): Promise<FeePaymentOrder> {
    const [row] = await tx
        .select()
        .from(schema.feePaymentOrders)
        .where(eq(schema.feePaymentOrders.id, feePaymentOrderId))
        .limit(1);

    if (!row) throw new NotFoundError("FeePaymentOrder", feePaymentOrderId);
    return row;
}
