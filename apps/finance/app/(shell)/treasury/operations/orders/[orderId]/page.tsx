import { notFound } from "next/navigation";

import { TreasuryOrderDetailsView } from "@/features/treasury/operations/components/order-details";
import { getTreasuryOrderDetails } from "@/features/treasury/operations/lib/queries";

interface TreasuryOrderPageProps {
  params: Promise<{ orderId: string }>;
}

export default async function TreasuryOrderPage({
  params,
}: TreasuryOrderPageProps) {
  const { orderId } = await params;
  const order = await getTreasuryOrderDetails(orderId);
  if (!order) notFound();
  return <TreasuryOrderDetailsView order={order} />;
}
