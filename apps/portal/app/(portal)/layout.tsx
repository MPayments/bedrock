import { PortalHeader } from "@/components/portal/portal-header";
import { PortalMobileNav } from "@/components/portal/portal-mobile-nav";
import { requirePortalSession } from "@/lib/auth/session";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requirePortalSession();

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <PortalHeader session={session} />
      <main className="mx-auto flex-1 w-full max-w-5xl px-4 py-4 pb-20 md:px-6 md:pb-4 lg:px-8">
        {children}
      </main>
      <PortalMobileNav />
    </div>
  );
}
