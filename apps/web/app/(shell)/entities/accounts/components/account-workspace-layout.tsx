"use client";

import { Wallet } from "lucide-react";

import { EntityWorkspaceLayout } from "@/components/entities/workspace-layout";

type AccountWorkspaceLayoutProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export function AccountWorkspaceLayout({
  title,
  subtitle,
  children,
}: AccountWorkspaceLayoutProps) {
  return (
    <EntityWorkspaceLayout title={title} subtitle={subtitle} icon={Wallet}>
      {children}
    </EntityWorkspaceLayout>
  );
}
