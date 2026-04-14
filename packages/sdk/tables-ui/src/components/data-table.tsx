"use client";

import {
  flexRender,
  type Row as TanstackRow,
  type Table as TanstackTable,
} from "@tanstack/react-table";
import { ExternalLink } from "lucide-react";
import * as React from "react";
import * as ReactDOM from "react-dom";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bedrock/sdk-ui/components/table";
import { cn } from "@bedrock/sdk-ui/lib/utils";
import { getCommonPinningStyles } from "@bedrock/sdk-tables-ui/lib/data-table";

import { DataTablePagination } from "@bedrock/sdk-tables-ui/components/data-table-pagination";

export interface ContextMenuItem<TData> {
  label: string;
  onClick: (row: TanstackRow<TData>) => void;
  icon?: React.ReactNode;
}

interface DataTableProps<TData> extends React.ComponentProps<"div"> {
  table: TanstackTable<TData>;
  actionBar?: React.ReactNode;
  onRowDoubleClick?: (
    row: TanstackRow<TData>,
    event: React.MouseEvent<HTMLTableRowElement>,
  ) => void;
  contextMenuItems?: ContextMenuItem<TData>[] | ((row: TanstackRow<TData>) => ContextMenuItem<TData>[]);
}

interface ContextMenuState<TData> {
  x: number;
  y: number;
  row: TanstackRow<TData>;
}

function ContextMenuPortal<TData>({
  state,
  items,
  onClose,
}: {
  state: ContextMenuState<TData>;
  items: ContextMenuItem<TData>[];
  onClose: () => void;
}) {
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function handleScroll() {
      onClose();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [onClose]);

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        left: state.x,
        top: state.y,
        zIndex: 50,
      }}
      className="animate-in fade-in-0 zoom-in-95 ring-foreground/10 bg-popover text-popover-foreground min-w-32 rounded-lg p-1 shadow-md ring-1"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className="focus:bg-accent focus:text-accent-foreground gap-1.5 rounded-md px-1.5 py-1 text-sm [&_svg:not([class*='size-'])]:size-4 relative flex w-full cursor-default items-center outline-hidden select-none hover:bg-accent hover:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0"
          onClick={() => {
            item.onClick(state.row);
            onClose();
          }}
        >
          {item.icon ?? <ExternalLink className="text-muted-foreground" />}
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}

export function DataTable<TData>({
  table,
  actionBar,
  onRowDoubleClick,
  contextMenuItems,
  children,
  className,
  ...props
}: DataTableProps<TData>) {
  const [contextMenu, setContextMenu] = React.useState<ContextMenuState<TData> | null>(null);

  const onRowContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLTableRowElement>, row: TanstackRow<TData>) => {
      if (!contextMenuItems) return;
      event.preventDefault();
      setContextMenu({ x: event.clientX, y: event.clientY, row });
    },
    [contextMenuItems],
  );

  const closeContextMenu = React.useCallback(() => {
    setContextMenu(null);
  }, []);

  const resolvedItems = React.useMemo(() => {
    if (!contextMenu || !contextMenuItems) return [];
    return typeof contextMenuItems === "function"
      ? contextMenuItems(contextMenu.row)
      : contextMenuItems;
  }, [contextMenu, contextMenuItems]);

  return (
    <div
      className={cn("flex w-full flex-col gap-2.5 overflow-auto", className)}
      {...props}
    >
      {children}
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    style={{
                      ...getCommonPinningStyles({ column: header.column }),
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(onRowDoubleClick && "cursor-pointer")}
                    onDoubleClick={(event) => onRowDoubleClick?.(row, event)}
                    onContextMenu={(event) => onRowContextMenu(event, row)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        style={{
                          ...getCommonPinningStyles({ column: cell.column }),
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getAllColumns().length}
                  className="h-24 text-center"
                >
                  Нет результатов
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-col gap-2.5">
        <DataTablePagination table={table} />
        {actionBar &&
          table.getFilteredSelectedRowModel().rows.length > 0 &&
          actionBar}
      </div>

      {contextMenu && resolvedItems.length > 0 && (
        <ContextMenuPortal
          state={contextMenu}
          items={resolvedItems}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
