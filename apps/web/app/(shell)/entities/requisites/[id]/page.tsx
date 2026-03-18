import React from "react";
import { notFound } from "next/navigation";

import { EditRequisiteFormClient } from "@/features/entities/requisites/components/edit-requisite-form-client";
import { RequisiteWorkspaceLayout } from "@/features/entities/requisites/components/requisite-workspace-layout";
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
    <RequisiteWorkspaceLayout title={requisite.label}>
      <EditRequisiteFormClient requisite={requisite} options={options} />
    </RequisiteWorkspaceLayout>
  );
}
