import * as React from "react"

import { cn } from "@bedrock/sdk-ui/lib/utils"

type AuthBrandProps = React.ComponentProps<"div"> & {
  icon?: React.ReactNode
  title: React.ReactNode
}

type AuthShellProps = React.ComponentProps<"div"> & {
  brandClassName?: string
  contentClassName?: string
  prelude?: React.ReactNode
  title: React.ReactNode
}

function AuthBrandIcon({
  className,
  ...props
}: React.ComponentProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4", className)}
      aria-hidden="true"
      {...props}
    >
      <path d="M11.264 2.205A4 4 0 0 0 6.42 4.211l-4 8a4 4 0 0 0 1.359 5.117l6 4a4 4 0 0 0 4.438 0l6-4a4 4 0 0 0 1.576-4.592l-2-6a4 4 0 0 0-2.53-2.53z" />
      <path d="M11.99 22 14 12l7.822 3.184" />
      <path d="M14 12 8.47 2.302" />
    </svg>
  )
}

function AuthBrand({
  className,
  icon,
  title,
  ...props
}: AuthBrandProps) {
  return (
    <div
      data-slot="auth-brand"
      className={cn("flex items-center gap-2 self-center font-medium", className)}
      {...props}
    >
      <div
        data-slot="auth-brand-badge"
        className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md"
      >
        {icon ?? <AuthBrandIcon />}
      </div>
      {title}
    </div>
  )
}

function AuthShell({
  brandClassName,
  children,
  className,
  contentClassName,
  prelude,
  title,
  ...props
}: AuthShellProps) {
  return (
    <div
      data-slot="auth-shell"
      className={cn(
        "bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10",
        className,
      )}
      {...props}
    >
      <div
        data-slot="auth-shell-content"
        className={cn("flex w-full max-w-sm flex-col gap-6", contentClassName)}
      >
        {prelude}
        <AuthBrand title={title} className={brandClassName} />
        {children}
      </div>
    </div>
  )
}

export { AuthBrand, AuthBrandIcon, AuthShell }
