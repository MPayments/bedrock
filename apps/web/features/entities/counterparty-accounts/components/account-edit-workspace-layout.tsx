"use client";

import { useAccountDraftName } from "../lib/create-draft-name-context";
import { AccountWorkspaceLayout } from "./account-workspace-layout";
import { useEntityEditTitle } from "@/components/entities/workspace-layout";

type AccountEditWorkspaceLayoutProps = {
  accountId: string;
  initialTitle: string;
  children: React.ReactNode;
};

export function AccountEditWorkspaceLayout({
  accountId,
  initialTitle,
  children,
}: AccountEditWorkspaceLayoutProps) {
  const { actions, meta } = useAccountDraftName();

  const title = useEntityEditTitle({
    id: accountId,
    initialTitle,
    bridge: {
      registerEdit: actions.registerEdit,
      clearEdit: actions.clearEdit,
      getEditLabel: meta.getEditLabel,
    },
  });

  return (
    <AccountWorkspaceLayout title={title} subtitle="Карточка счёта">
      {children}
    </AccountWorkspaceLayout>
  );
}
