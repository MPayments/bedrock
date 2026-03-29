import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "@bedrock/sdk-ui/globals.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_TITLE || "VED CRM",
  description: process.env.NEXT_PUBLIC_APP_DESCRIPTION || "VED CRM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-accent antialiased`}
        style={
          {
            "--font-sans": "var(--font-geist-sans)",
          } as React.CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
