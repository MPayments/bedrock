"use client";

import { useEffect } from "react";

import { CustomerWorkspaceLayout } from "@/features/entities/customers/components/customer-workspace-layout";
import { useCustomerDraftName } from "@/features/entities/customers/lib/create-draft-name-context";

export default function CreateCustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { state, actions } = useCustomerDraftName();

  useEffect(() => {
    return () => {
      actions.resetCreateName();
    };
  }, [actions]);

  return (
    <CustomerWorkspaceLayout
      title={state.createLabel}
      subtitle="Карточка клиента"
      disabledTabs={["counterparties"]}
    >
      {children}
    </CustomerWorkspaceLayout>
  );
}
