import { notFound } from "next/navigation";

import { PaymentRouteConstructorClient } from "@/features/payment-routes/components/constructor-client";
import {
  getPaymentRouteConstructorOptions,
  getPaymentRouteTemplateById,
} from "@/features/payment-routes/lib/queries";

interface PaymentRouteConstructorDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PaymentRouteConstructorDetailPage({
  params,
}: PaymentRouteConstructorDetailPageProps) {
  const { id } = await params;
  const [options, template] = await Promise.all([
    getPaymentRouteConstructorOptions(),
    getPaymentRouteTemplateById(id),
  ]);

  if (!template) {
    notFound();
  }

  return <PaymentRouteConstructorClient options={options} template={template} />;
}
