import { redirect } from "next/navigation";
import { getPreferredHomePath } from "@/lib/auth/access";
import { getServerSessionSnapshot } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getServerSessionSnapshot();

  if (session.isAuthenticated) {
    redirect(getPreferredHomePath(session));
  }

  return <LoginForm />;
}
