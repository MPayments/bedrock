"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@multihansa/ui/components/sonner";
import { TooltipProvider } from "@multihansa/ui/components/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <NextThemesProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
        enableColorScheme
      >
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster richColors position="top-right" />
      </NextThemesProvider>
    </NuqsAdapter>
  );
}
