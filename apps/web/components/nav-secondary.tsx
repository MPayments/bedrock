"use client";

import * as React from "react";
import Link from "next/link";
import { type LucideIcon } from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@bedrock/ui/components/sidebar";
import type { AppSecondaryNavItem } from "@/lib/navigation/config";

import { NavNotifications } from "./nav-notifications";

export function NavSecondary({
  items,
  ...props
}: {
  items: AppSecondaryNavItem[];
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.id}>
              {item.kind === "notifications" ? (
                <NavNotifications icon={item.icon} title={item.title} />
              ) : (
                <SidebarMenuButton
                  render={<Link href={item.href} />}
                  tooltip={item.title}
                >
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
