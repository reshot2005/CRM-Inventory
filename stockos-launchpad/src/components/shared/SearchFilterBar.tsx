import { Download, Plus, Search } from "lucide-react";
import type { ReactNode } from "react";

interface SearchFilterBarProps {
  placeholder?: string;
  filters?: ReactNode;
  onSearch?: (value: string) => void;
  addLabel?: string;
  onAdd?: () => void;
}

export default function SearchFilterBar({
  placeholder = "Search...",
  filters,
  onSearch,
  addLabel = "Add New",
  onAdd,
}: SearchFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-64 min-w-[220px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
        <input
          className="w-full rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] py-2.5 pl-10 pr-3 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
          placeholder={placeholder}
          onChange={(e) => onSearch?.(e.target.value)}
        />
      </div>
      {filters}
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] transition hover:bg-[#F8FAFF]"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#1D4ED8]"
        >
          <Plus className="h-4 w-4" />
          {addLabel}
        </button>
      </div>
    </div>
  );
}
