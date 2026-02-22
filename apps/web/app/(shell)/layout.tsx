import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@bedrock/ui/components/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@bedrock/ui/components/sidebar";
import { OrganizationCreateDraftNameProvider } from "./entities/organizations/lib/create-draft-name-context";

export default function ShellLayout({
  children,
  breadcrumb,
}: {
  children: React.ReactNode;
  breadcrumb: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <OrganizationCreateDraftNameProvider>
          <header className="flex h-12 shrink-0 items-center gap-2">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 w-px h-4" />
              {breadcrumb}
            </div>
          </header>
          <Separator orientation="horizontal" className="h-px w-full" />
          <div className="flex flex-1 flex-col p-6">{children}</div>
        </OrganizationCreateDraftNameProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
