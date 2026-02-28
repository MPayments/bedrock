"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@bedrock/ui/components/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@bedrock/ui/components/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@bedrock/ui/components/sidebar";

import type { AppNavItem } from "@/lib/navigation/config";

function normalizePath(path: string) {
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }
  return path;
}

function isPathActive(pathname: string, href: string) {
  if (!href.startsWith("/")) {
    return false;
  }

  const currentPath = normalizePath(pathname);
  const targetPath = normalizePath(href);

  if (targetPath === "/") {
    return currentPath === "/";
  }

  return (
    currentPath === targetPath || currentPath.startsWith(`${targetPath}/`)
  );
}

function NavCollapsibleItem({
  item,
  pathname,
}: {
  item: AppNavItem;
  pathname: string;
}) {
  const { state, isMobile } = useSidebar();
  const subItems = item.children ?? [];
  const isActive =
    isPathActive(pathname, item.href) ||
    subItems.some((sub) => isPathActive(pathname, sub.href));
  const [open, setOpen] = useState(isActive);

  // Auto-open the group when a sub-item becomes active via navigation
  useEffect(() => {
    if (isActive) {
      setOpen(true);
    }
  }, [isActive]);

  // Collapsed sidebar (icon mode): show a dropdown menu for sub-items
  if (state === "collapsed" && !isMobile) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton tooltip={item.title} />}
          >
            {item.icon && <item.icon />}
            <span>{item.title}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="right"
            align="start"
            sideOffset={4}
            className="w-42"
          >
            <DropdownMenuGroup>
              {subItems.map((subItem) => (
                <DropdownMenuItem
                  key={subItem.id}
                  render={<Link href={subItem.href} />}
                >
                  {subItem.icon && <subItem.icon className="size-4" />}
                  <span>{subItem.title}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }

  // Expanded sidebar: show a collapsible section
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger render={<SidebarMenuButton tooltip={item.title} />}>
          {item.icon && <item.icon />}
          <span>{item.title}</span>
          <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {subItems.map((subItem) => (
              <SidebarMenuSubItem key={subItem.id}>
                <SidebarMenuSubButton
                  render={<Link href={subItem.href} />}
                  isActive={isPathActive(pathname, subItem.href)}
                >
                  {subItem.icon && <subItem.icon className="size-4" />}
                  <span>{subItem.title}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function NavMain({ items }: { items: AppNavItem[] }) {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Разделы</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const hasSubItems = Boolean(item.children?.length);
          const subItems = item.children ?? [];
          const isActive = hasSubItems
            ? isPathActive(pathname, item.href) ||
              subItems.some((sub) => isPathActive(pathname, sub.href))
            : isPathActive(pathname, item.href);

          if (!hasSubItems) {
            return (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  render={<Link href={item.href} />}
                  isActive={isActive}
                  tooltip={item.title}
                >
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          }

          return (
            <NavCollapsibleItem
              key={item.id}
              item={item}
              pathname={pathname}
            />
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
