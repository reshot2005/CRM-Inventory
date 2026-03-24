import { ChevronDown, ChevronUp } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo, useState, type ReactNode } from "react";
import EmptyState from "@/components/shared/EmptyState";

export interface DataColumn<T> {
  id: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyState?: {
    icon: ReactNode;
    title: string;
    description: string;
    cta?: ReactNode;
  };
  onRowClick?: (row: T) => void;
  totalItems?: number;
}

export default function DataTable<T>({
  columns,
  data,
  loading,
  emptyState,
  onRowClick,
  totalItems,
}: DataTableProps<T>) {
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [order, setOrder] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    if (!sortBy) return data;
    const column = columns.find((c) => c.id === sortBy);
    if (!column?.sortValue) return data;

    return [...data].sort((a, b) => {
      const va = column.sortValue ? column.sortValue(a) : "";
      const vb = column.sortValue ? column.sortValue(b) : "";
      if (va < vb) return order === "asc" ? -1 : 1;
      if (va > vb) return order === "asc" ? 1 : -1;
      return 0;
    });
  }, [columns, data, order, sortBy]);

  const onSort = (id: string, canSort: boolean) => {
    if (!canSort) return;
    if (sortBy === id) {
      setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(id);
    setOrder("asc");
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="sticky top-0 z-10 bg-[#F1F5F9]">
            <tr>
              {columns.map((col) => {
                const canSort = Boolean(col.sortValue);
                return (
                  <th
                    key={col.id}
                    className="px-4 py-3 text-left text-xs uppercase tracking-wide text-[#64748B]"
                  >
                    <button
                      type="button"
                      onClick={() => onSort(col.id, canSort)}
                      className="inline-flex items-center gap-1"
                    >
                      {col.header}
                      {canSort ? (
                        sortBy === col.id && order === "asc" ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )
                      ) : null}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`s-${i}`} className="border-t border-[#F1F5F9]">
                    {columns.map((col) => (
                      <td key={`${col.id}-${i}`} className="px-4 py-3">
                        <div className="h-4 w-full animate-pulse rounded bg-[#E2E8F0]" />
                      </td>
                    ))}
                  </tr>
                ))
              : null}

            {!loading && sorted.length === 0 && emptyState ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState
                    icon={emptyState.icon}
                    title={emptyState.title}
                    description={emptyState.description}
                    cta={emptyState.cta}
                  />
                </td>
              </tr>
            ) : null}

            {!loading
              ? sorted.map((row, idx) => (
                  <motion.tr
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="border-t border-[#F1F5F9] transition hover:bg-[#F8FAFF]"
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((col) => (
                      <td key={col.id} className={`px-4 py-3 text-sm text-[#0F172A] ${col.className ?? ""}`}>
                        {col.render(row)}
                      </td>
                    ))}
                  </motion.tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-[#F1F5F9] px-4 py-3 text-xs text-[#64748B]">
        <span>
          Showing 1-{Math.min(sorted.length, 10)} of {totalItems ?? sorted.length} items
        </span>
        <div className="flex items-center gap-2">
          <button type="button" className="rounded border border-[#E2E8F0] px-2 py-1 hover:bg-[#F8FAFF]">Prev</button>
          <button type="button" className="rounded border border-[#E2E8F0] px-2 py-1 hover:bg-[#F8FAFF]">Next</button>
        </div>
      </div>
    </div>
  );
}
