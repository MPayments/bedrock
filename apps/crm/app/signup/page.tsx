import { redirect } from "next/navigation";
import { getPreferredHomePath } from "@/lib/auth/access";
import { getServerSessionSnapshot } from "@/lib/auth/session";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  const session = await getServerSessionSnapshot();

  if (session.isAuthenticated) {
    redirect(getPreferredHomePath(session));
  }

  return <SignupForm />;
}
