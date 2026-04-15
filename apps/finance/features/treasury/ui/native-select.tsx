"use client";

import type { ReactNode } from "react";

type NativeSelectProps = {
  children: ReactNode;
  disabled?: boolean;
  onChange: (value: string) => void;
  value: string;
};

export function NativeSelect({
  children,
  disabled = false,
  onChange,
  value,
}: NativeSelectProps) {
  return (
    <select
      className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs focus-visible:ring-1 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {children}
    </select>
  );
}
