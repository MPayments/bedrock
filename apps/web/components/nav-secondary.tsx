"use client";

import * as React from "react";
import Link from "next/link";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@bedrock/sdk-ui/components/sidebar";
import type { AppSecondaryNavItem } from "@/lib/navigation/config";
import { resolveAppIcon } from "@/lib/icons";
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
            <SecondaryNavItem key={item.id} item={item} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function SecondaryNavItem({ item }: { item: AppSecondaryNavItem }) {
  const Icon = resolveAppIcon(item.icon);

  return (
    <SidebarMenuItem>
      {item.kind === "notifications" ? (
        Icon ? <NavNotifications icon={Icon} title={item.title} /> : null
      ) : (
        <SidebarMenuButton render={<Link href={item.href} />} tooltip={item.title}>
          {Icon && <Icon />}
          <span>{item.title}</span>
        </SidebarMenuButton>
      )}
    </SidebarMenuItem>
  );
}
