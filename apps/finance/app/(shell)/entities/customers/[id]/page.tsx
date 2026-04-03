import { EditCustomerFormClient } from "@/features/entities/customers/components/edit-customer-form-client";
import { getCustomerById } from "@/features/entities/customers/lib/queries";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";

interface CustomerPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerPage({ params }: CustomerPageProps) {
  const { entity: customer } = await loadResourceByIdParamOrNotFound({
    params,
    getById: getCustomerById,
  });

  return <EditCustomerFormClient customer={customer} />;
}
