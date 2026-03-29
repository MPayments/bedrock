"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { API_BASE_URL } from "@/lib/constants";

/**
 * Customer root page - redirects to appropriate page based on clients status
 * - Has clients → /customer/clients
 * - No clients → /customer/onboard
 */
export default function CustomerDashboard() {
  const router = useRouter();

  useEffect(() => {
    async function checkClients() {
      try {
        const response = await fetch(`${API_BASE_URL}/customer/clients`, {
          credentials: "include",
        });

        if (!response.ok) {
          router.push("/customer/onboard");
          return;
        }

        const clients = await response.json();

        if (clients.length === 0) {
          router.push("/customer/onboard");
        } else {
          router.push("/customer/clients");
        }
      } catch (error) {
        console.error("Error checking clients:", error);
        router.push("/customer/onboard");
      }
    }

    checkClients();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
