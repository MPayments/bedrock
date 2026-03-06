"use client";

import { Stone } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@bedrock/ui/components/avatar";

import { SOURCE_LABELS } from "../lib/constants";

const SOURCE_LOGO_BY_ID: Partial<Record<string, string>> = {
  cbr: "/images/cbr.png",
  investing: "/images/investing.png",
  xe: "/images/xe.png",
};

const SOURCE_ICON_BY_ID: Partial<Record<string, typeof Stone>> = {
  manual: Stone,
};

function getSourceInitials(source: string): string {
  const label = SOURCE_LABELS[source] ?? source;
  const parts = label
    .split(/[\s./_-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return source.slice(0, 2).toUpperCase();
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

type FxSourceAvatarProps = {
  source: string;
  size?: "default" | "sm" | "lg";
  className?: string;
};

export function FxSourceAvatar({
  source,
  size = "default",
  className,
}: FxSourceAvatarProps) {
  const label = SOURCE_LABELS[source] ?? source;
  const logoSrc = SOURCE_LOGO_BY_ID[source];
  const SourceIcon = SOURCE_ICON_BY_ID[source];

  return (
    <Avatar size={size} className={className ?? "bg-background"} title={label}>
      {logoSrc ? (
        <AvatarImage
          src={logoSrc}
          alt={label}
          className="bg-background object-contain"
        />
      ) : null}
      <AvatarFallback className="text-[10px] font-medium uppercase">
        {SourceIcon ? <SourceIcon className="h-4 w-4" /> : getSourceInitials(source)}
      </AvatarFallback>
    </Avatar>
  );
}
