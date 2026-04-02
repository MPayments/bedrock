"use client";

import { Handshake } from "lucide-react";

import { EntityWorkspaceLayout } from "@/components/entities/workspace-layout";

type FinanceDealWorkspaceLayoutProps = {
  title: string;
  children: React.ReactNode;
};

export function FinanceDealWorkspaceLayout({
  title,
  children,
}: FinanceDealWorkspaceLayoutProps) {
  return (
    <EntityWorkspaceLayout
      title={title}
      subtitle="Рабочий стол сделки"
      icon={Handshake}
    >
      {children}
    </EntityWorkspaceLayout>
  );
}
