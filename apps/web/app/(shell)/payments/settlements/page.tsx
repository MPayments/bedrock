import { PaymentsListCard } from "@/features/payments/ui/payments-list-card";
import { listPayments } from "@/features/payments/lib/api";

export default async function SettlementsPage() {
  const resolutions = await listPayments({
    kind: "resolution",
    limit: 100,
    offset: 0,
  });

  return (
    <PaymentsListCard
      title="Платежные резолюшены"
      description="Системные документы `payment_resolution` (settle/void/fail)."
      rows={resolutions.data}
    />
  );
}
