import { getAccountById } from "@/features/entities/counterparty-accounts/lib/queries";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";

import { EditAccountBreadcrumb } from "./edit-account-breadcrumb";

interface EditAccountBreadcrumbPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditAccountBreadcrumbPage({
  params,
}: EditAccountBreadcrumbPageProps) {
  const { entity: account } = await loadResourceByIdParamOrNotFound({
    params,
    getById: getAccountById,
  });

  return (
    <EditAccountBreadcrumb
      accountId={account.id}
      initialLabel={account.label}
    />
  );
}
