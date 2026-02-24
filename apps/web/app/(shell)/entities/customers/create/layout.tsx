"use client";

import { useEffect } from "react";

import { CustomerWorkspaceLayout } from "../components/customer-workspace-layout";
import { useCustomerDraftName } from "../lib/create-draft-name-context";

export default function CreateCustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { state, actions } = useCustomerDraftName();

  useEffect(() => {
    actions.resetCreateName();
  }, [actions]);

  return (
    <CustomerWorkspaceLayout
      title={state.createLabel}
      subtitle="Карточка клиента"
    >
      {children}
    </CustomerWorkspaceLayout>
  );
}
