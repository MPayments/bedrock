import { EditProviderFormClient } from "@/features/entities/counterparty-account-providers/components/edit-provider-form-client";
import { getProviderById } from "@/features/entities/counterparty-account-providers/lib/queries";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";

interface ProviderPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProviderPage({ params }: ProviderPageProps) {
  const { entity: provider } = await loadResourceByIdParamOrNotFound({
    params,
    getById: getProviderById,
  });

  return <EditProviderFormClient provider={provider} />;
}
