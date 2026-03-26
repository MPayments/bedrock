import { redirect } from "next/navigation";
import { getServerSessionSnapshot } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getServerSessionSnapshot();

  if (session.isAuthenticated) {
    redirect("/");
  }

  return <LoginForm />;
}
