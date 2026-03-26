"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface OverflowTooltipProps {
  children: React.ReactNode;
  tooltipText: string;
  className?: string;
  disabled?: boolean;
}

export function OverflowTooltip({
  children,
  tooltipText,
  className,
  disabled,
}: OverflowTooltipProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => {
      setIsOverflowing(el.scrollWidth > el.clientWidth);
    };

    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [tooltipText]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span ref={ref} className={cn("truncate", className)}>
          {children}
        </span>
      </TooltipTrigger>
      {isOverflowing && !disabled && (
        <TooltipContent>{tooltipText}</TooltipContent>
      )}
    </Tooltip>
  );
}
