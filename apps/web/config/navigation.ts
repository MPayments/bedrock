import {
  ArrowRightLeft,
  Bell,
  BookOpen,
  Building2,
  Calculator,
  ChartCandlestick,
  CreditCard,
  Currency,
  DollarSign,
  Home,
  Landmark,
  ListChecks,
  Receipt,
  Settings2,
  Users,
  Vault,
  Wallet,
  Workflow,
} from "lucide-react";

import type { NavMainItem } from "@/components/nav-main";
import type { NavSecondaryItem } from "@/components/nav-secondary";

export const navMainItems: NavMainItem[] = [
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
        title: "Журнал",
        url: "/operations/journal",
        icon: BookOpen,
      },
      {
        title: "Платежи",
        url: "/operations/payments",
        icon: CreditCard,
      },
      {
        title: "Пополнения",
        url: "/operations/funding",
        icon: DollarSign,
      },
      {
        title: "Расчетные операции",
        url: "/operations/settlements",
        icon: ListChecks,
      },
    ],
  },
  {
    title: "Бухгалтерия",
    url: "/accounting",
    icon: Calculator,
    items: [
      {
        title: "Счета",
        url: "/accounting/accounts",
      },
      {
        title: "Корреспонденция",
        url: "/accounting/correspondence",
      },
      {
        title: "Финрез",
        url: "/accounting/financial-results",
      },
    ],
  },
  {
    title: "Справочники",
    url: "/entities",
    icon: BookOpen,
    items: [
      {
        title: "Клиенты",
        url: "/entities/customers",
        icon: Users,
      },
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
      {
        title: "Валюты",
        url: "/entities/currencies",
        icon: DollarSign,
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
];

export const navSecondaryItems: NavSecondaryItem[] = [
  {
    kind: "notifications",
    title: "Уведомления",
    icon: Bell,
  },
];
