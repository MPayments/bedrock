import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff } from "lucide-react";
import { Column } from "@tanstack/react-table";

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@bedrock/sdk-ui/components/dropdown-menu";
import { Button } from "@bedrock/sdk-ui/components/button";

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column?: Column<TData, TValue>;
  title?: string;
  align?: "left" | "center" | "right";
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title = "",
  align = "left",
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const alignClass = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  }[align];

  if (!column || !column.getCanSort()) {
    return <div className={cn(alignClass, className)}>{title}</div>;
  }

  return (
    <div
      className={cn(
        "flex items-center space-x-2",
        align === "right"
          ? "justify-end"
          : align === "center"
            ? "justify-center"
            : "",
        className
      )}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="-ml-3 h-8 data-[state=open]:bg-accent"
            />
          }
        >
          <span className={alignClass}>{title}</span>
          {column.getIsSorted() === "desc" ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === "asc" ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
            <ArrowUp className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
            По возрастанию
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
            <ArrowDown className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
            По убыванию
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
            <EyeOff className="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
            Скрыть
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
