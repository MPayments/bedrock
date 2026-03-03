"use client";

import { Landmark } from "lucide-react";

import { EntityWorkspaceLayout } from "@/components/entities/workspace-layout";

type ProviderWorkspaceLayoutProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export function ProviderWorkspaceLayout({
  title,
  subtitle,
  children,
}: ProviderWorkspaceLayoutProps) {
  return (
    <EntityWorkspaceLayout title={title} subtitle={subtitle} icon={Landmark}>
      {children}
    </EntityWorkspaceLayout>
  );
}
