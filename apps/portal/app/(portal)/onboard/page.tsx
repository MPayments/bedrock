import { redirect } from "next/navigation";

import { getServerSessionSnapshot } from "@/lib/auth/session";

import { CustomerOnboardingForm } from "./onboard-form";

export default async function PortalOnboardPage() {
  const session = await getServerSessionSnapshot();

  if (session.hasCustomerPortalAccess) {
    redirect("/clients");
  }

  if (!session.hasOnboardingAccess) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-[80dvh] flex-col justify-center">
      <CustomerOnboardingForm />
    </div>
  );
}
