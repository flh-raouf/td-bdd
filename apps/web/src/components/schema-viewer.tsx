import {
  ChevronDown,
  ChevronRight,
  Database,
  Eye,
  ScanEye,
  Table,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { ErDiagram } from "@/components/er-diagram";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lens } from "@/components/ui/lens";
import { Separator } from "@/components/ui/separator";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { modKey } from "@/lib/platform";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type SchemaViewerProps = {
  onClose?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center rounded-sm border px-1 py-0.5 font-mono text-xs leading-none opacity-50">
      {children}
    </kbd>
  );
}

export function SchemaViewer({
  onClose,
  open,
  onOpenChange,
}: SchemaViewerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = onOpenChange !== undefined;
  const showModal = controlled ? (open ?? false) : internalOpen;
  const setShowModal = controlled
    ? (v: boolean) => onOpenChange(v)
    : setInternalOpen;

  const [activeTab, setActiveTab] = useState<"er" | "tables">("er");
  const [lensEnabled, setLensEnabled] = useState(false);

  const handleClose = useCallback(() => {
    setShowModal(false);
    onClose?.();
  }, [setShowModal, onClose]);

  const handleOpen = useCallback(() => {
    setShowModal(true);
    setActiveTab("er");
  }, [setShowModal]);

  const showModalRef = useRef(showModal);
  showModalRef.current = showModal;
  const handleCloseRef = useRef(handleClose);
  handleCloseRef.current = handleClose;
  const handleOpenRef = useRef(handleOpen);
  handleOpenRef.current = handleOpen;

  useMountEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        if (showModalRef.current) {
          handleCloseRef.current();
        } else {
          handleOpenRef.current();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <>
      <Button
        size="sm"
        onClick={handleOpen}
        className="border border-border bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
      >
        <Database className="mr-1 h-4 w-4" />
        Database Schema
        <span className="ml-1.5 inline-flex items-center gap-0.5">
          <Kbd>{modKey()}</Kbd>+<Kbd>\</Kbd>
        </span>
      </Button>

      {showModal && (
        <div>
          <button
            type="button"
            className="fixed inset-0 z-50 cursor-default border-none bg-black/60 p-0"
            onClick={handleClose}
            onKeyDown={(e) => {
              if (e.key === "Escape") handleClose();
            }}
            aria-label="Close schema viewer"
          />
          <div
            className="fixed inset-4 z-50 mx-auto flex max-w-5xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg"
            onKeyDown={(e) => {
              if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement
              )
                return;
              if (e.metaKey || e.ctrlKey || e.altKey) return;
              if (e.key === "d") setActiveTab("er");
              if (e.key === "t") setActiveTab("tables");
            }}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("er")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    activeTab === "er"
                      ? "bg-sidebar-active text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Eye className="h-4 w-4" />
                  ER Diagram
                  <Kbd>D</Kbd>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("tables")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    activeTab === "tables"
                      ? "bg-sidebar-active text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Table className="h-4 w-4" />
                  Tables
                  <Kbd>T</Kbd>
                </button>
              </div>
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {activeTab === "er" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center">
                    <Button
                      size="sm"
                      variant={lensEnabled ? "default" : "ghost"}
                      onClick={() => setLensEnabled(!lensEnabled)}
                      className="gap-1.5"
                    >
                      <ScanEye className="h-4 w-4" />
                      {lensEnabled ? "Lens On" : "Lens Off"}
                    </Button>
                  </div>
                  {lensEnabled ? (
                    <Lens zoomFactor={1.5} lensSize={250}>
                      <ErDiagram />
                    </Lens>
                  ) : (
                    <ErDiagram />
                  )}
                </div>
              ) : (
                <TablesPanel />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TablesPanel() {
  const { data: tables } = trpc.schema.tables.useQuery();
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const toggleTable = (tableName: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableName)) next.delete(tableName);
      else next.add(tableName);
      return next;
    });
    setSelectedTable(tableName);
  };

  if (!tables || tables.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No tables found.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {tables.map(({ tableName }) => {
        const isExpanded = expandedTables.has(tableName);
        return (
          <div
            key={tableName}
            className="overflow-hidden rounded-lg border border-border"
          >
            <button
              type="button"
              onClick={() => toggleTable(tableName)}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-left transition-colors hover:bg-sidebar-hover",
                selectedTable === tableName && "bg-sidebar-active",
              )}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <Table className="h-4 w-4 text-accent" />
              <span className="text-foreground">{tableName}</span>
            </button>
            {isExpanded && <TableDetails tableName={tableName} />}
          </div>
        );
      })}
    </div>
  );
}

function TableDetails({ tableName }: { tableName: string }) {
  const { data: columns } = trpc.schema.tableColumns.useQuery(tableName);
  const { data: tableData, isLoading: isDataLoading } =
    trpc.schema.tableData.useQuery(tableName);

  return (
    <div className="border-t border-border bg-sidebar/50 px-4 py-3">
      {columns && (
        <div className="mb-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Columns
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Name</th>
                <th className="pb-2 pr-4 font-medium">Type</th>
                <th className="pb-2 font-medium">Key</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((col, idx) => (
                <tr
                  key={col.columnName}
                  className={cn(idx % 2 === 0 && "bg-white/[0.02]")}
                >
                  <td className="py-2 pr-4 font-mono text-sm text-foreground">
                    {col.columnName}
                  </td>
                  <td className="py-2 pr-4 font-mono text-sm text-accent">
                    {col.columnType}
                  </td>
                  <td className="py-2">
                    {col.columnKey === "PRI" ? (
                      <Badge className="border-blue-500/40 bg-blue-500/10 text-blue-400">
                        PK
                      </Badge>
                    ) : col.columnKey === "MUL" ? (
                      <Badge className="border-orange-500/40 bg-orange-500/10 text-orange-400">
                        FK
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isDataLoading && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Loading preview...
        </p>
      )}

      {tableData && tableData.rows.length > 0 && (
        <div>
          <Separator className="mb-3" />
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Data preview ({tableData.rows.length} row
            {tableData.rows.length !== 1 ? "s" : ""})
          </p>
          <div className="overflow-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-sidebar-active">
                  {tableData.columns.map((col) => (
                    <th
                      key={col}
                      className="whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.rows.map((row, i) => (
                  <tr
                    key={JSON.stringify(row)}
                    className={cn(
                      "border-b border-border/50 last:border-0",
                      i % 2 === 0 && "bg-white/[0.02]",
                    )}
                  >
                    {tableData.columns.map((col) => (
                      <td
                        key={col}
                        className="whitespace-nowrap px-3 py-1.5 font-mono text-sm text-foreground"
                      >
                        {String(row[col] ?? "NULL")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
