"use client";

import * as React from "react";
import {
  ArrowRightLeft,
  CreditCard,
  Currency,
  Home,
  Landmark,
  Settings2,
  Stone,
  Users,
} from "lucide-react";

import { NavMain } from "./nav-main";
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
} from "@bedrock/ui/components/sidebar";

// This is sample data.
const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Дашборд",
      url: "/",
      icon: Home,
      isActive: true,
    },
    {
      title: "Казначейство",
      url: "#",
      icon: Landmark,
      items: [
        {
          title: "Клиенты",
          url: "#",
        },
        {
          title: "Организации",
          url: "#",
        },
        {
          title: "Счета",
          url: "#",
        },
      ],
    },
    {
      title: "FX",
      url: "#",
      icon: Currency,
      items: [
        {
          title: "Курсы",
          url: "#",
        },
        {
          title: "Котировки",
          url: "#",
        },
        {
          title: "Политики",
          url: "#",
        },
      ],
    },
    {
      title: "Переводы",
      url: "#",
      icon: ArrowRightLeft,
    },
    {
      title: "Платежи",
      url: "#",
      icon: CreditCard,
      items: [
        {
          title: "Ордера",
          url: "#",
        },
        {
          title: "Расчетные операции",
          url: "#",
        },
      ],
    },
    {
      title: "Пользователи",
      url: "#",
      icon: Users,
    },
    {
      title: "Настройки",
      url: "#",
      icon: Settings2,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<a href="/" />}
              className="font-semibold"
              tooltip="Bedrock"
            >
              <div className="size-8 rounded-full bg-primary text-primary-foreground flex aspect-square items-center justify-center">
                <Stone className="size-6" />
              </div>
              <div className="grid flex-1 text-left text-xl leading-tight">
                <span className="truncate font-semibold">Bedrock Finance</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
