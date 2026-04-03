import { AuthShell } from "@bedrock/sdk-ui/components/auth-shell"

const APP_TITLE = "Multihansa Finance"

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <AuthShell title={APP_TITLE}>
      {children}
    </AuthShell>
  )
}
