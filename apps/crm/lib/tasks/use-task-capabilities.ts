"use client";

import { useEffect, useState } from "react";

import {
  getCrmTaskCapabilities,
} from "@/lib/tasks/client";
import type { CrmTaskCapabilities } from "@/lib/tasks/contracts";

export function useCrmTaskCapabilities() {
  const [capabilities, setCapabilities] =
    useState<CrmTaskCapabilities | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadCapabilities() {
      try {
        const nextCapabilities = await getCrmTaskCapabilities();
        if (isMounted) {
          setCapabilities(nextCapabilities);
        }
      } catch (error) {
        console.error("Failed to load CRM task capabilities:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadCapabilities();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    capabilities,
    isLoading,
  };
}
