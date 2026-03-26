"use client";

import { Briefcase, Building2, FileText, Home, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  // {
  //   href: "/customer",
  //   label: "Главная",
  //   icon: Home,
  // },
  {
    href: "/customer/clients",
    label: "Организации",
    icon: Building2,
  },
  {
    href: "/customer/applications",
    label: "Заявки",
    icon: FileText,
  },
  {
    href: "/customer/deals",
    label: "Сделки",
    icon: Briefcase,
  },
  // {
  //   href: "/customer/profile",
  //   label: "Профиль",
  //   icon: User,
  // },
];

export function CustomerMobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background pb-safe md:hidden">
      <div className="flex h-16 items-center justify-around">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/customer" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs transition-colors",
                "active:bg-muted",
                isActive
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon
                className={cn("h-5 w-5", isActive && "text-primary")}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
