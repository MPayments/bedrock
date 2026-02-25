import { ProviderEditWorkspaceLayout } from "../components/provider-edit-workspace-layout";
import { getProviderById } from "../lib/queries";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";

export default async function ProviderLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { entity: provider } = await loadResourceByIdParamOrNotFound({
    params,
    getById: getProviderById,
  });

  return (
    <ProviderEditWorkspaceLayout
      providerId={provider.id}
      initialTitle={provider.name}
    >
      {children}
    </ProviderEditWorkspaceLayout>
  );
}
