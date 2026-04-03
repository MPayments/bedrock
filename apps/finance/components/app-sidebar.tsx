import Link from "next/link";
import { Stone } from "lucide-react";

import type { UserSessionSnapshot } from "@/lib/auth/types";
import type {
  AppNavItem,
  AppSecondaryNavItem,
} from "@/lib/navigation/config";

import { NavMain } from "./nav-main";
import { NavSecondary } from "./nav-secondary";
import { NavUser } from "./nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@bedrock/sdk-ui/components/sidebar";

export function AppSidebar({
  items,
  secondaryItems,
  session,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  items: AppNavItem[];
  secondaryItems: AppSecondaryNavItem[];
  session: UserSessionSnapshot;
}) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" />}
              className="font-semibold"
              tooltip="Bedrock"
            >
              <div className="size-8 rounded-full bg-primary text-primary-foreground flex aspect-square items-center justify-center">
                <Stone className="size-6" />
              </div>
              <div className="grid flex-1 text-left text-xl leading-tight">
                <span className="truncate font-semibold">Multihansa Finance</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={items} />
        <NavSecondary items={secondaryItems} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser session={session} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
