import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@bedrock/sdk-ui/components/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@bedrock/sdk-ui/components/sidebar";
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
          <div className="flex flex-1 flex-col gap-4 p-6">
            {session.requiresTwoFactorSetup ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
                <p className="text-sm font-medium">
                  Настройте двухфакторную аутентификацию
                </p>
                <p className="mt-1 text-sm text-amber-900/90">
                  Для Treasury она будет обязательной. Завершите настройку в профиле,
                  чтобы не потерять доступ после включения жесткой политики.
                </p>
              </div>
            ) : null}
            {children}
          </div>
        </EntityDraftNameProviders>
      </SidebarInset>
    </SidebarProvider>
  );
}
