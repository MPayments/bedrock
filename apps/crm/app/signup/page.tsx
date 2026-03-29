import { redirect } from "next/navigation";
import { getServerSessionSnapshot } from "@/lib/auth/session";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  const session = await getServerSessionSnapshot();

  if (session.isAuthenticated) {
    redirect("/");
  }

  return <SignupForm />;
}
