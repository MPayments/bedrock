import { PaymentsListCard } from "@/features/payments/ui/payments-list-card";
import { listPayments } from "@/features/payments/lib/api";

export default async function OrdersPage() {
  const intents = await listPayments({
    kind: "intent",
    limit: 100,
    offset: 0,
  });

  return (
    <PaymentsListCard
      title="Платежные интенты"
      description="Список `payment_intent` документов с текущим workflow-статусом."
      rows={intents.data}
      detailsBasePath="/payments/orders"
    />
  );
}
