import { AccountEditWorkspaceLayout } from "@/features/entities/counterparty-accounts/components/account-edit-workspace-layout";
import { getAccountById } from "@/features/entities/counterparty-accounts/lib/queries";
import { loadResourceByIdParamOrNotFound } from "@/lib/resources/routes";

export default async function AccountLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { entity: account } = await loadResourceByIdParamOrNotFound({
    params,
    getById: getAccountById,
  });

  return (
    <AccountEditWorkspaceLayout
      accountId={account.id}
      initialTitle={account.label}
    >
      {children}
    </AccountEditWorkspaceLayout>
  );
}
