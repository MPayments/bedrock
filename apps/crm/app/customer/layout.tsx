import { CustomerHeader } from "@/components/customer/customer-header";
import { CustomerMobileNav } from "@/components/customer/customer-mobile-nav";
import { requireCustomerSession } from "@/lib/auth/session";

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCustomerSession();

  // Note: Onboarding check (has clients) is done in individual pages
  // to avoid redirect loops and allow access to /customer/onboard

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <CustomerHeader />
      {/* Main content with mobile-first padding */}
      <main className="flex-1 px-4 py-4 pb-20 md:pb-4 md:px-6 lg:px-8 max-w-3xl mx-auto w-full">
        {children}
      </main>
      {/* Bottom navigation for mobile */}
      <CustomerMobileNav />
    </div>
  );
}
