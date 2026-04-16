import { PaymentRouteConstructorClient } from "@/features/payment-routes/components/constructor-client";
import { getPaymentRouteConstructorOptions } from "@/features/payment-routes/lib/queries";

export default async function PaymentRouteConstructorPage() {
  const options = await getPaymentRouteConstructorOptions();

  return <PaymentRouteConstructorClient options={options} template={null} />;
}
