"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRightLeft,
  Bell,
  Building2,
  BookOpen,
  Currency,
  Home,
  Landmark,
  Settings2,
  Stone,
  Users,
  ChartCandlestick,
  ListChecks,
  Workflow,
  CreditCard,
  Receipt,
  DollarSign,
  Wallet,
  Vault,
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
import { NavSecondary } from "./nav-secondary";

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
    },
    {
      title: "Казначейство",
      url: "/treasury",
      icon: Vault,
      items: [
        {
          title: "Клиенты",
          url: "/treasury/customers",
        },
        {
          title: "Контрагенты",
          url: "/treasury/counterparties",
          icon: Building2,
        },
        {
          title: "Счета",
          url: "/treasury/accounts",
        },
      ],
    },
    {
      title: "FX",
      url: "/fx",
      icon: Currency,
      items: [
        {
          title: "Курсы",
          url: "/fx/rates",
          icon: ChartCandlestick,
        },
        {
          title: "Котировки",
          url: "/fx/quotes",
          icon: Receipt,
        },
      ],
    },
    // {
    //   title: "Переводы",
    //   url: "/transfers",
    //   icon: ArrowRightLeft,
    // },
    // {
    //   title: "Платежи",
    //   url: "/payments",
    //   icon: CreditCard,
    //   items: [
    //     {
    //       title: "Ордера",
    //       url: "/payments/orders",
    //     },
    //     {
    //       title: "Расчетные операции",
    //       url: "/payments/settlements",
    //     },
    //   ],
    // },
    {
      title: "Операции",
      url: "/operations",
      icon: Workflow,
      items: [
        {
          title: "Переводы",
          url: "/operations/transfers",
          icon: ArrowRightLeft,
        },
        {
          title: "Платежи",
          url: "/operations/payments",
          icon: CreditCard,
        },
        {
          title: "Расчетные операции",
          url: "/operations/settlements",
          icon: ListChecks,
        },
      ],
    },
    {
      title: "Справочники",
      url: "/entities",
      icon: BookOpen,
      items: [
        {
          title: "Контрагенты",
          url: "/entities/counterparties",
          icon: Building2,
        },
        {
          title: "Расчетные методы",
          url: "/entities/providers",
          icon: Landmark,
        },
        {
          title: "Счета",
          url: "/entities/accounts",
          icon: Wallet,
        },
        { title: "Валюты", url: "/entities/currencies", icon: DollarSign },
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
  navSecondary: [
    {
      title: "Уведомления",
      url: "#",
      icon: Bell,
    },
    // {
    //   title: "Активность",
    //   url: "#",
    //   icon: Activity,
    // },
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
              render={<Link href="/" />}
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
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
