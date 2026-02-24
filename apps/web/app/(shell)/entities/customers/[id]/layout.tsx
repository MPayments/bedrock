import { CustomerEditWorkspaceLayout } from "../components/customer-edit-workspace-layout";
import { getCustomerById } from "../lib/queries";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";

export default async function CustomerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { entity: customer } = await loadResourceByIdParamOrNotFound({
    params,
    getById: getCustomerById,
  });

  return (
    <CustomerEditWorkspaceLayout
      customerId={customer.id}
      initialTitle={customer.displayName}
    >
      {children}
    </CustomerEditWorkspaceLayout>
  );
}
