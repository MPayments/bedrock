import { notFound } from "next/navigation";

import { OperationDetailsCards } from "@/features/operations/journal/components/operation-details-cards";
import { getOperationById } from "@/features/operations/journal/lib/queries";

interface OperationDetailsPageProps {
  params: Promise<{ operationId: string }>;
}

export default async function OperationDetailsPage({
  params,
}: OperationDetailsPageProps) {
  const { operationId } = await params;
  const details = await getOperationById(operationId);

  if (!details) {
    notFound();
  }

  return <OperationDetailsCards details={details} />;
}
