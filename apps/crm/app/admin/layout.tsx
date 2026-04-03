import type { ReactNode } from "react";
import { AppHeader } from "@/components/app/header";
import { requireAdminSession } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const session = await requireAdminSession();

  return (
    <>
      <AppHeader session={session} />
      <main className="mx-auto max-w-[1920px] p-4">{children}</main>
    </>
  );
}
