"use client";

import { useEffect } from "react";

import { useCustomerDraftName } from "../lib/create-draft-name-context";
import { CustomerWorkspaceLayout } from "./customer-workspace-layout";

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
  const { registerEditCustomer, clearEditCustomer, getEditLabel } =
    useCustomerDraftName();

  useEffect(() => {
    registerEditCustomer(customerId, initialTitle);

    return () => {
      clearEditCustomer(customerId);
    };
  }, [
    clearEditCustomer,
    customerId,
    initialTitle,
    registerEditCustomer,
  ]);

  return (
    <CustomerWorkspaceLayout
      title={getEditLabel(customerId, initialTitle)}
      subtitle="Карточка клиента"
    >
      {children}
    </CustomerWorkspaceLayout>
  );
}
