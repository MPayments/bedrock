import "@bedrock/ui/globals.css";
import { Providers } from "@/components/providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        style={
          {
            "--font-sans":
              '"SF Pro Text", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
            "--font-geist-mono":
              '"SF Mono", "JetBrains Mono", "Fira Code", monospace',
          } as React.CSSProperties
        }
        className="antialiased"
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
