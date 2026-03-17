import React from "react";
import { notFound } from "next/navigation";
import { Wallet } from "lucide-react";

import { EntityWorkspaceLayout } from "@/components/entities/workspace-layout";
import { EditRequisiteFormClient } from "@/features/entities/requisites/components/edit-requisite-form-client";
import {
  getRequisiteById,
  getRequisiteFormOptions,
} from "@/features/entities/requisites/lib/queries";

interface RequisitePageProps {
  params: Promise<{ id: string }>;
}

export default async function RequisitePage({ params }: RequisitePageProps) {
  const { id } = await params;
  const [requisite, options] = await Promise.all([
    getRequisiteById(id),
    getRequisiteFormOptions(),
  ]);

  if (!requisite) {
    notFound();
  }

  return (
    <EntityWorkspaceLayout
      title={requisite.label}
      subtitle="Карточка реквизита"
      icon={Wallet}
    >
      <EditRequisiteFormClient requisite={requisite} options={options} />
    </EntityWorkspaceLayout>
  );
}
