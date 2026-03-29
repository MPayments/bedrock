import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CustomerLoginForm } from "./customer-login-form";

export default function CustomerLoginPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Back button - fixed at top for mobile */}
      <div className="p-4">
        <Button variant="ghost" size="sm" className="h-9 px-2" asChild>
          <Link href="/login">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Для сотрудников
          </Link>
        </Button>
      </div>

      {/* Main content - centered */}
      <div className="flex-1 flex flex-col justify-center px-6 pb-safe">
        <div className="w-full max-w-sm mx-auto">
          <CustomerLoginForm />
        </div>
      </div>

      {/* Footer branding */}
      <div className="p-6 text-center">
        <span className="text-xs text-muted-foreground">MPayments</span>
      </div>
    </div>
  );
}
