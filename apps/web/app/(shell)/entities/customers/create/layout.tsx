"use client";

import { useEffect } from "react";

import { CustomerWorkspaceLayout } from "../components/customer-workspace-layout";
import { useCustomerDraftName } from "../lib/create-draft-name-context";

export default function CreateCustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { createLabel, resetCreateName } = useCustomerDraftName();

  useEffect(() => {
    resetCreateName();
  }, [resetCreateName]);

  return (
    <CustomerWorkspaceLayout title={createLabel} subtitle="Карточка клиента">
      {children}
    </CustomerWorkspaceLayout>
  );
}
