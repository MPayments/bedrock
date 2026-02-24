import { CounterpartyEditWorkspaceLayout } from "../components/counterparty-edit-workspace-layout";
import { getCounterpartyById } from "../lib/queries";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";

export default async function CounterpartyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { entity: counterparty } = await loadResourceByIdParamOrNotFound({
    params,
    getById: getCounterpartyById,
  });

  return (
    <CounterpartyEditWorkspaceLayout
      counterpartyId={counterparty.id}
      initialTitle={counterparty.shortName}
    >
      {children}
    </CounterpartyEditWorkspaceLayout>
  );
}
