"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Landmark,
  Currency,
  CreditCard,
  ArrowRightLeft,
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

type BreadcrumbEntry = {
  label: string;
  href?: string;
  icon?: LucideIcon;
};

type SegmentConfig = BreadcrumbEntry & {
  dynamicChild?: (segment: string) => BreadcrumbEntry;
};

const segmentMap: Record<string, SegmentConfig> = {
  // Sections (with icons)
  treasury: { label: "Казначейство", icon: Landmark },
  fx: { label: "FX", icon: Currency },
  payments: { label: "Платежи", icon: CreditCard },
  transfers: { label: "Переводы", icon: ArrowRightLeft },

  // Treasury pages
  customers: {
    label: "Клиенты",
    href: "/treasury/customers",
    dynamicChild: (id) => ({ label: `Клиент #${id}` }),
  },
  organizations: { label: "Организации" },
  accounts: { label: "Счета" },

  // FX pages
  rates: { label: "Курсы" },
  quotes: { label: "Котировки" },
  policies: { label: "Политики" },

  // Payments pages
  orders: { label: "Ордера" },
  settlements: { label: "Расчетные операции" },
};

function resolveSegments(segments: string[]): BreadcrumbEntry[] {
  const items: BreadcrumbEntry[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const config = segmentMap[seg];

    if (config) {
      items.push({
        label: config.label,
        href: config.href,
        icon: config.icon,
      });
    } else {
      const prev = i > 0 ? segmentMap[segments[i - 1]!] : undefined;
      if (prev?.dynamicChild) {
        items.push(prev.dynamicChild(seg));
      }
    }
  }

  return items;
}

export function DynamicBreadcrumb() {
  const pathname = usePathname();

  // Dashboard (root)
  if (pathname === "/") {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-1.5">
              <Home className="size-4" />
              <span className="hidden md:inline">Дашборд</span>
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  const segments = pathname.split("/").filter(Boolean);
  const items = resolveSegments(segments);

  if (items.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const Icon = item.icon;

          // On mobile, root-level items with icons show only the icon
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
