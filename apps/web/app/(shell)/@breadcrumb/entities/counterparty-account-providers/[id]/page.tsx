import { getProviderById } from "@/app/(shell)/entities/counterparty-account-providers/lib/queries";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";

import { EditProviderBreadcrumb } from "./edit-provider-breadcrumb";

interface EditProviderBreadcrumbPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProviderBreadcrumbPage({
  params,
}: EditProviderBreadcrumbPageProps) {
  const { entity: provider } = await loadResourceByIdParamOrNotFound({
    params,
    getById: getProviderById,
  });

  return (
    <EditProviderBreadcrumb
      providerId={provider.id}
      initialLabel={provider.name}
    />
  );
}
