import { describe, expect, it } from "vitest";

import { resolveBreadcrumbItems } from "@/lib/breadcrumbs";

describe("breadcrumbs", () => {
  it("uses canonical hrefs for static workspace segments", async () => {
    await expect(resolveBreadcrumbItems(["accounting", "accounts"])).resolves.toEqual([
      { label: "Бухгалтерия", href: "/accounting", icon: "book-open" },
      { label: "Счета", href: "/accounting/accounts", icon: "wallet" },
    ]);

    await expect(resolveBreadcrumbItems(["fx", "rates"])).resolves.toEqual([
      { label: "FX", href: "/fx", icon: "currency" },
      { label: "Курсы", href: "/fx/rates", icon: "chart-candlestick" },
    ]);
  });

  it("uses canonical hrefs for entity and treasury counterparties", async () => {
    await expect(resolveBreadcrumbItems(["entities", "customers"])).resolves.toEqual([
      { label: "Справочники", href: "/entities", icon: "book-open" },
      { label: "Клиенты", href: "/entities/customers", icon: "handshake" },
    ]);

    await expect(resolveBreadcrumbItems(["entities", "counterparties"])).resolves.toEqual([
      { label: "Справочники", href: "/entities", icon: "book-open" },
      { label: "Контрагенты", href: "/entities/counterparties", icon: "building-2" },
    ]);

    await expect(resolveBreadcrumbItems(["treasury", "counterparties"])).resolves.toEqual([
      { label: "Казначейство", href: "/treasury", icon: "landmark" },
      { label: "Контрагенты", href: "/treasury/counterparties", icon: "building-2" },
    ]);
  });
});
