import type { ReactNode } from "react";
import { AppHeader } from "@/components/app/header";
import { requireAdminSession } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  await requireAdminSession();

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-[1920px] p-4">{children}</main>
    </>
  );
}
