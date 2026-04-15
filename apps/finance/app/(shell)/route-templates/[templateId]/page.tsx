import { notFound } from "next/navigation";

import { RouteTemplateWorkspace } from "@/features/treasury/route-templates/components/workspace";
import { getFinanceRouteTemplateWorkspaceById } from "@/features/treasury/route-templates/lib/queries";

interface RouteTemplatePageProps {
  params: Promise<{ templateId: string }>;
}

export default async function RouteTemplatePage({
  params,
}: RouteTemplatePageProps) {
  const { templateId } = await params;
  const workspace = await getFinanceRouteTemplateWorkspaceById(templateId);

  if (!workspace) {
    notFound();
  }

  return <RouteTemplateWorkspace data={workspace} />;
}
