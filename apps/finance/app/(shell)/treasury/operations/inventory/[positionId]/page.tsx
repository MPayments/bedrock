import { notFound } from "next/navigation";

import { TreasuryInventoryDetailsView } from "@/features/treasury/operations/components/inventory-details";
import { getTreasuryInventoryPositionDetails } from "@/features/treasury/operations/lib/queries";

interface TreasuryInventoryPositionPageProps {
  params: Promise<{ positionId: string }>;
}

export default async function TreasuryInventoryPositionPage({
  params,
}: TreasuryInventoryPositionPageProps) {
  const { positionId } = await params;
  const position = await getTreasuryInventoryPositionDetails(positionId);
  if (!position) notFound();
  return <TreasuryInventoryDetailsView position={position} />;
}
