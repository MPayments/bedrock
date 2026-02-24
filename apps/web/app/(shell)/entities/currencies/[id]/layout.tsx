import { CurrencyEditWorkspaceLayout } from "../components/currency-edit-workspace-layout";
import { getCurrencyById } from "../lib/queries";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";

export default async function CurrencyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { entity: currency } = await loadResourceByIdParamOrNotFound({
    params,
    getById: getCurrencyById,
  });

  return (
    <CurrencyEditWorkspaceLayout
      currencyId={currency.id}
      initialTitle={currency.name}
    >
      {children}
    </CurrencyEditWorkspaceLayout>
  );
}
