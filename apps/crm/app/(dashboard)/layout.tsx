import type { ReactNode } from "react";
import { AppHeader } from "@/components/app/header";
import { requireDashboardSession } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  await requireDashboardSession();

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-[1920px] p-4">{children}</main>
    </>
  );
}
