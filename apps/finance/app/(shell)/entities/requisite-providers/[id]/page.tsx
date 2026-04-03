import { notFound } from "next/navigation";

import { EditRequisiteProviderFormClient } from "@/features/entities/requisite-providers/components/edit-requisite-provider-form-client";
import { getRequisiteProviderById } from "@/features/entities/requisite-providers/lib/queries";

interface RequisiteProviderPageProps {
  params: Promise<{ id: string }>;
}

export default async function RequisiteProviderPage({
  params,
}: RequisiteProviderPageProps) {
  const { id } = await params;
  const provider = await getRequisiteProviderById(id);

  if (!provider) {
    notFound();
  }

  return <EditRequisiteProviderFormClient provider={provider} />;
}
