import type { ReactNode } from "react";
import { AppHeader } from "@/components/app/header";
import { requireDashboardSession } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const session = await requireDashboardSession();

  return (
    <>
      <AppHeader session={session} />
      <main className="mx-auto max-w-[1440px] px-6 py-6">{children}</main>
    </>
  );
}
