"use client";

import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { API_BASE_URL } from "@/lib/constants";

interface CustomerClientsResponse {
  data: { id: number }[];
  total: number;
}

export default function PortalRootPage() {
  const router = useRouter();

  useEffect(() => {
    async function checkClients() {
      try {
        const response = await fetch(`${API_BASE_URL}/customer/clients`, {
          credentials: "include",
        });

        if (!response.ok) {
          router.push("/onboard");
          return;
        }

        const clients: CustomerClientsResponse = await response.json();

        if (clients.total === 0) {
          router.push("/onboard");
        } else {
          router.push("/clients");
        }
      } catch (error) {
        console.error("Error checking clients:", error);
        router.push("/onboard");
      }
    }

    void checkClients();
  }, [router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
