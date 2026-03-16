"use client";

import { DollarSign } from "lucide-react";

import { EntityWorkspaceLayout } from "@/components/entities/workspace-layout";

type CurrencyWorkspaceLayoutProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export function CurrencyWorkspaceLayout({
  title,
  subtitle,
  children,
}: CurrencyWorkspaceLayoutProps) {
  return (
    <EntityWorkspaceLayout title={title} subtitle={subtitle} icon={DollarSign}>
      {children}
    </EntityWorkspaceLayout>
  );
}
