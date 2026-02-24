"use client";

import Link from "next/link";
import {
  ArrowRightLeft,
  BookOpen,
  Building2,
  ChartCandlestick,
  CreditCard,
  Currency,
  DollarSign,
  Home,
  Landmark,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@bedrock/ui/components/breadcrumb";

import type { BreadcrumbIconName, BreadcrumbItem as AppBreadcrumbItem } from "@/lib/breadcrumbs";

const iconMap: Record<BreadcrumbIconName, LucideIcon> = {
  home: Home,
  landmark: Landmark,
  currency: Currency,
  "credit-card": CreditCard,
  "arrow-right-left": ArrowRightLeft,
  "building-2": Building2,
  users: Users,
  "book-open": BookOpen,
  "dollar-sign": DollarSign,
  "chart-candlestick": ChartCandlestick,
};

type DynamicBreadcrumbProps = {
  items: AppBreadcrumbItem[];
};

export function DynamicBreadcrumb({ items }: DynamicBreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const Icon = item.icon ? iconMap[item.icon] : undefined;
          const label = Icon ? (
            <span className="hidden md:inline">{item.label}</span>
          ) : (
            item.label
          );

          return (
            <span key={`${item.label}-${index}`} className="contents">
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage className="flex items-center gap-1.5">
                    {Icon && <Icon className="size-4" />}
                    {label}
                  </BreadcrumbPage>
                ) : item.href ? (
                  <BreadcrumbLink
                    render={<Link href={item.href} />}
                    className="flex items-center gap-1.5"
                  >
                    {Icon && <Icon className="size-4" />}
                    {label}
                  </BreadcrumbLink>
                ) : (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    {Icon && <Icon className="size-4" />}
                    {label}
                  </span>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
