"use client";

import { Users } from "lucide-react";

import { EntityWorkspaceLayout } from "@/components/entities/workspace-layout";

type CustomerWorkspaceLayoutProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export function CustomerWorkspaceLayout({
  title,
  subtitle,
  children,
}: CustomerWorkspaceLayoutProps) {
  return (
    <EntityWorkspaceLayout title={title} subtitle={subtitle} icon={Users}>
      {children}
    </EntityWorkspaceLayout>
  );
}
