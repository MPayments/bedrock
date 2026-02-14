import { eq } from "drizzle-orm";
import { schema } from "@bedrock/db/schema";

import { NotFoundError } from "../errors";

export async function fetchOrderState(tx: any, orderId: string) {
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

export async function fetchFeePaymentOrderState(tx: any, feePaymentOrderId: string) {
    const [row] = await tx
        .select()
        .from(schema.feePaymentOrders)
        .where(eq(schema.feePaymentOrders.id, feePaymentOrderId))
        .limit(1);

    if (!row) throw new NotFoundError("FeePaymentOrder", feePaymentOrderId);
    return row;
}
