"use client";

import * as React from "react";
import { Workflow } from "lucide-react";

import { EntityWorkspaceLayout } from "@/components/entities/workspace-layout";

type PaymentRouteWorkspaceLayoutProps = {
  children: React.ReactNode;
  headerControls?: React.ReactNode;
  subtitle: string;
  title: string;
};

export function PaymentRouteWorkspaceLayout({
  children,
  headerControls,
  subtitle,
  title,
}: PaymentRouteWorkspaceLayoutProps) {
  return (
    <EntityWorkspaceLayout
      title={title}
      subtitle={subtitle}
      icon={Workflow}
      headerControls={headerControls}
    >
      {children}
    </EntityWorkspaceLayout>
  );
}
