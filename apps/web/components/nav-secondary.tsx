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
import { NavNotifications } from "./nav-notifications";

export type NavSecondaryItem =
  | {
      kind: "link";
      title: string;
      url: string;
      icon?: LucideIcon;
    }
  | {
      kind: "notifications";
      title: string;
      icon: LucideIcon;
    };

export function NavSecondary({
  items,
  ...props
}: {
  items: NavSecondaryItem[];
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={`${item.kind}-${item.title}`}>
              {item.kind === "notifications" ? (
                <NavNotifications icon={item.icon} title={item.title} />
              ) : (
                <SidebarMenuButton
                  render={<Link href={item.url} />}
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
