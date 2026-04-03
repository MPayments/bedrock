import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "@bedrock/sdk-ui/globals.css";
import { Providers } from "@/components/providers";

const geist = Geist({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Multihansa Finance",
  description: "Multihansa Finance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geist.variable} ${geistMono.variable} antialiased`}
        style={
          {
            "--font-sans": "var(--font-geist)",
          } as React.CSSProperties
        }
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
