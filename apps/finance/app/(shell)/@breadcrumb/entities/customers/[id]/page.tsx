import { getCustomerById } from "@/features/entities/customers/lib/queries";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";

import { EditCustomerBreadcrumb } from "./edit-customer-breadcrumb";

interface EditCustomerBreadcrumbPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCustomerBreadcrumbPage({
  params,
}: EditCustomerBreadcrumbPageProps) {
  const { entity: customer } = await loadResourceByIdParamOrNotFound({
    params,
    getById: getCustomerById,
  });

  return (
    <EditCustomerBreadcrumb
      customerId={customer.id}
      initialLabel={customer.name}
    />
  );
}
