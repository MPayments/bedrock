"use client";

import { useCustomerDraftName } from "../lib/create-draft-name-context";
import { CustomerWorkspaceLayout } from "./customer-workspace-layout";
import { useEntityEditTitle } from "@/components/entities/workspace-layout";

type CustomerEditWorkspaceLayoutProps = {
  customerId: string;
  initialTitle: string;
  children: React.ReactNode;
};

export function CustomerEditWorkspaceLayout({
  customerId,
  initialTitle,
  children,
}: CustomerEditWorkspaceLayoutProps) {
  const { actions, meta } = useCustomerDraftName();

  const title = useEntityEditTitle({
    id: customerId,
    initialTitle,
    bridge: {
      registerEdit: actions.registerEdit,
      clearEdit: actions.clearEdit,
      getEditLabel: meta.getEditLabel,
    },
  });

  return (
    <CustomerWorkspaceLayout title={title} subtitle="Карточка клиента">
      {children}
    </CustomerWorkspaceLayout>
  );
}
