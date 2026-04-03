import { redirect } from "next/navigation";

import { AuthShell } from "@bedrock/sdk-ui/components/auth-shell";

import { getServerSessionSnapshot } from "@/lib/auth/session";

import { LoginForm } from "./login-form";

const APP_TITLE = process.env.NEXT_PUBLIC_APP_TITLE || "Multihansa CRM";

export default async function LoginPage() {
  const session = await getServerSessionSnapshot();

  if (session.isAuthenticated) {
    redirect("/");
  }

  return <AuthShell title={APP_TITLE}><LoginForm /></AuthShell>;
}
