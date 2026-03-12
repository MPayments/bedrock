import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@bedrock/ui/components/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@bedrock/ui/components/sidebar";
import { EntityDraftNameProviders } from "@/features/entities/shared/entity-draft-name-providers";
import { getServerSessionSnapshot } from "@/lib/auth/session";
import {
  getPrimaryNavigation,
  getSecondaryNavigation,
} from "@/lib/navigation/config";

export default async function ShellLayout({
  children,
  breadcrumb,
}: {
  children: React.ReactNode;
  breadcrumb: React.ReactNode;
}) {
  const session = await getServerSessionSnapshot();

  if (!session.isAuthenticated) {
    redirect("/login");
  }

  return (
    <SidebarProvider>
      <AppSidebar
        session={session}
        items={getPrimaryNavigation(session)}
        secondaryItems={getSecondaryNavigation(session)}
      />
      <SidebarInset>
        <EntityDraftNameProviders>
          <header className="flex h-12 shrink-0 items-center gap-2">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 w-px h-4" />
              {breadcrumb}
            </div>
          </header>
          <Separator orientation="horizontal" className="h-px w-full" />
          <div className="flex flex-1 flex-col p-6">{children}</div>
        </EntityDraftNameProviders>
      </SidebarInset>
    </SidebarProvider>
  );
}
