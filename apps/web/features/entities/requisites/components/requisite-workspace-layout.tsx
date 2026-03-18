"use client";

import * as React from "react";
import { Wallet } from "lucide-react";

import { EntityWorkspaceLayout } from "@/components/entities/workspace-layout";

type RequisiteWorkspaceLayoutProps = {
  title: string;
  children: React.ReactNode;
};

export function RequisiteWorkspaceLayout({
  title,
  children,
}: RequisiteWorkspaceLayoutProps) {
  return (
    <EntityWorkspaceLayout
      title={title}
      subtitle="Карточка реквизита"
      icon={Wallet}
    >
      {children}
    </EntityWorkspaceLayout>
  );
}
